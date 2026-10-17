import neo4j, { Driver, Session } from "neo4j-driver";
import { env } from "@/config/env";

/**
 * Neo4j Driver singleton — เหตุผลเดียวกับ prisma.ts (กัน tsx watch สร้าง
 * connection pool ใหม่ซ้ำ ๆ ตอน hot-reload จนหลุด connection limit ของ Aura)
 *
 * Schema/ความสัมพันธ์ที่ driver นี้คุยด้วยอ้างอิงจาก recommendation_graph_import.cql
 * ในโฟลเดอร์ buddybook_real:
 *   (:User)-[:INTERESTED_IN]->(:Tag)
 *   (:Novel)-[:HAS_TAG]->(:Tag)
 *   (:User)-[:READ {sentiment_score, rating}]->(:Novel)
 * Neo4j เป็น derived store (ดู BuddyBook_System_Architecture.md ส่วนที่ 4.2) — PostgreSQL
 * ยังคงเป็น single source of truth เสมอ ห้ามเขียนรายละเอียดเนื้อหา/โปรไฟล์เต็มลงที่นี่
 */
declare global {
  // eslint-disable-next-line no-var
  var __neo4jDriver__: Driver | undefined;
}

export const neo4jDriver =
  global.__neo4jDriver__ ??
  neo4j.driver(env.NEO4J_URI, neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD));

if (env.NODE_ENV !== "production") {
  global.__neo4jDriver__ = neo4jDriver;
}

/**
 * เปิด session ใหม่ต่อหนึ่งหน่วยงาน แล้วปิดเสมอ (ห้ามแชร์ session ข้าม request —
 * ตาม Neo4j driver docs) ใช้ครอบทุก query/transaction ที่ยิงเข้า recommendations module
 */
export async function withNeo4jSession<T>(
  work: (session: Session) => Promise<T>
): Promise<T> {
  const session = neo4jDriver.session(
    env.NEO4J_DATABASE ? { database: env.NEO4J_DATABASE } : undefined
  );
  try {
    return await work(session);
  } finally {
    await session.close();
  }
}

/** เพิ่มภายหลัง (perf) — timeout ต่อ query ของหน้าที่ผู้ใช้รออยู่ (เช่น recommendations บนหน้าแรก)
 *  กราฟช้า/ค้างต้องไม่ลากทั้งหน้าไปด้วย — เกินนี้ driver ยกเลิก transaction แล้วฝั่ง service degrade เป็นผลว่าง
 *  ปรับได้ด้วย env NEO4J_READ_TIMEOUT_MS (ค่าเริ่มต้น 2000) */
export const NEO4J_READ_TIMEOUT_MS = env.NEO4J_READ_TIMEOUT_MS;

/** ปลายทางที่ driver ต่ออยู่จริง (ไม่มีรหัสผ่าน) — ใช้ใน log ให้เห็นทันทีว่าต่อ Aura หรือ container local
 *  (api ใน Docker ใช้ค่าจาก docker/api.docker.env ที่ทับ apps/api/.env → bolt://neo4j:7687 ไม่ใช่ Aura) */
export function describeNeo4jTarget(): string {
  let host = env.NEO4J_URI;
  try {
    const u = new URL(env.NEO4J_URI);
    host = `${u.protocol}//${u.host}`;
  } catch {
    // URI ผิดรูปแบบ — แสดงตามที่ตั้งไว้ ให้เห็นว่าผิด
  }
  return `${host} user=${env.NEO4J_USER} db=${env.NEO4J_DATABASE ?? "(default)"}`;
}

export type Neo4jFailureReason = "timeout" | "unavailable" | "auth" | "database_not_found" | "error";

/** แปลง error ของ driver เป็นเหตุผลสั้น ๆ + คำแนะนำ สำหรับ log และ meta.graph_reason */
export function classifyNeo4jError(err: unknown): { reason: Neo4jFailureReason; hint: string } {
  const code = (err as { code?: string })?.code ?? "";
  const message = err instanceof Error ? err.message : String(err);
  if (code.includes("TransactionTimedOut") || /timed? ?out/i.test(message)) {
    return {
      reason: "timeout",
      hint: `query เกิน ${NEO4J_READ_TIMEOUT_MS} ms — Neo4j ช้าเกินไป (เครื่อง RAM น้อย/กราฟเพิ่งบูต) เพิ่ม NEO4J_READ_TIMEOUT_MS ได้`,
    };
  }
  if (code === "ServiceUnavailable" || code === "SessionExpired" || /ECONNREFUSED|ENOTFOUND|Could not perform discovery|Failed to connect/i.test(message)) {
    return { reason: "unavailable", hint: "ต่อ Neo4j ไม่ได้ — เช็คว่า instance เปิดอยู่ และ NEO4J_URI ถูกต้อง (Aura ต้องเป็น neo4j+s://)" };
  }
  if (code.startsWith("Neo.ClientError.Security")) {
    return { reason: "auth", hint: "username/password ไม่ถูกต้อง — เช็ค NEO4J_USER / NEO4J_PASSWORD" };
  }
  if (code === "Neo.ClientError.Database.DatabaseNotFound") {
    return { reason: "database_not_found", hint: "ไม่มี database ตาม NEO4J_DATABASE (Neo4j Community มีแค่ \"neo4j\")" };
  }
  return { reason: "error", hint: code ? `${code}: ${message.split("\n")[0]}` : message.split("\n")[0] };
}

/** เรียกครั้งเดียวตอน api เริ่ม — log ว่าต่อที่ไหน ต่อได้ไหม และกราฟมีข้อมูลหรือยัง (กราฟว่าง = ระบบแนะนำได้แต่ยอดนิยม) */
export async function logNeo4jStartupStatus(logger: Pick<Console, "log" | "warn"> = console): Promise<void> {
  const target = describeNeo4jTarget();
  try {
    await neo4jDriver.verifyConnectivity();
    const counts = await withNeo4jSession(async (session) => {
      const res = await session.run(
        "MATCH (n) WHERE n:User OR n:Novel OR n:Tag RETURN labels(n)[0] AS label, count(*) AS c"
      );
      return Object.fromEntries(res.records.map((r) => [r.get("label"), Number(r.get("c"))]));
    });
    const summary = `User=${counts.User ?? 0} Novel=${counts.Novel ?? 0} Tag=${counts.Tag ?? 0}`;
    if (!counts.Novel) {
      logger.warn(
        `[neo4j] connected to ${target} but the graph has no Novel nodes (${summary}) — ` +
          "recommendations will fall back to popular novels until a full resync runs " +
          "(POST /api/v1/internal/recommendations/sync or the recommendations-full-resync job)"
      );
    } else {
      logger.log(`[neo4j] connected to ${target} (${summary})`);
    }
  } catch (err) {
    const { reason, hint } = classifyNeo4jError(err);
    logger.warn(`[neo4j] NOT READY (${reason}) at ${target} — ${hint}`);
  }
}

/** เพิ่มภายหลัง (perf) — index ของ property ที่ทุก MATCH/MERGE ใช้หา node (ดู lib/graphSync.ts)
 *  เดิมไม่มีเลย (มีแค่ LOOKUP index ของ label) ทุก `MATCH (u:User {user_id})` จึงสแกนทั้ง label
 *  ใช้ range index ไม่ใช่ unique constraint เพื่อไม่ให้ล้มถ้ากราฟเดิมมี node ซ้ำ — IF NOT EXISTS รันซ้ำได้
 *  เรียกครั้งเดียวตอน api เริ่ม (server.ts) ถ้า Neo4j ยังไม่พร้อมแค่เตือน ไม่ทำให้ api ล่ม */
export async function ensureNeo4jIndexes(): Promise<void> {
  await withNeo4jSession(async (session) => {
    await session.run("CREATE INDEX user_user_id IF NOT EXISTS FOR (u:User) ON (u.user_id)");
    await session.run("CREATE INDEX novel_novel_id IF NOT EXISTS FOR (n:Novel) ON (n.novel_id)");
    await session.run("CREATE INDEX tag_name IF NOT EXISTS FOR (t:Tag) ON (t.name)");
  });
}

export async function verifyNeo4jConnectivity(): Promise<void> {
  await neo4jDriver.verifyConnectivity();
}
