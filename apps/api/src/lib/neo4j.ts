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

export async function verifyNeo4jConnectivity(): Promise<void> {
  await neo4jDriver.verifyConnectivity();
}
