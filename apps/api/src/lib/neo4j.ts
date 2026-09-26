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
 *  กราฟช้า/ค้างต้องไม่ลากทั้งหน้าไปด้วย — เกินนี้ driver ยกเลิก transaction แล้วฝั่ง service degrade เป็นผลว่าง */
export const NEO4J_READ_TIMEOUT_MS = 2000;

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
