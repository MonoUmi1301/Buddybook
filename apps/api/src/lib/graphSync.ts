import { withNeo4jSession } from "@/lib/neo4j";

/**
 * เขียนข้อมูลเข้า Neo4j recommendation graph — เรียกหลัง PostgreSQL commit สำเร็จแล้วเสมอ
 * (Neo4j เป็นแค่ derived store ตาม BuddyBook_System_Architecture.md ส่วนที่ 4.2 — ถ้า sync
 * ล้มเหลว ไม่ควร fail request หลักที่เรียกมา ผู้เรียกควร catch เองแล้ว log ไว้เฉย ๆ)
 * Schema อ้างอิงจาก recommendation_graph_import.cql:
 *   (:User)-[:INTERESTED_IN]->(:Tag)
 *   (:Novel)-[:HAS_TAG]->(:Tag)
 *   (:User)-[:READ {sentiment_score}]->(:Novel)
 */

/** เพิ่มภายหลัง (audit fix — ลบบัญชี user) — Neo4j เป็น derived store ไม่มี FK/cascade
 *  แบบ Postgres เอง ถ้าไม่ลบ node นี้ตอน user ลบบัญชี จะกลายเป็น "node ผี" ค้างอยู่ในกราฟตลอดไป
 *  ไม่มีทาง Postgres มาบอกได้อีกว่าควรลบ (ไม่มี foreign key ข้ามระบบ) — DETACH DELETE ลบทั้ง node
 *  และทุก edge ที่ต่อกับมัน (INTERESTED_IN, READ ทั้งสองทิศทาง) ในคำสั่งเดียว ปลอดภัยเพราะข้อมูล
 *  ความสนใจ/ประวัติการอ่านเป็นของ user คนนั้นล้วน ๆ ไม่กระทบข้อมูลของคนอื่นในกราฟเลย */
export async function deleteUserGraphNode(user_id: string) {
  await withNeo4jSession((session) =>
    session.run("MATCH (u:User {user_id: $user_id}) DETACH DELETE u", { user_id })
  );
}

export async function syncUserNode(user_id: string, username: string) {
  await withNeo4jSession((session) =>
    session.run("MERGE (u:User {user_id: $user_id}) SET u.username = $username", { user_id, username })
  );
}

export async function syncNovelNode(novel_id: string, title: string) {
  await withNeo4jSession((session) =>
    session.run("MERGE (n:Novel {novel_id: $novel_id}) SET n.title = $title", { novel_id, title })
  );
}

/** แทนที่ INTERESTED_IN ทั้งหมดของ user คนนี้ด้วยชุด tag ปัจจุบัน — idempotent เรียกซ้ำได้ปลอดภัย
 *  (ตอน onboarding เลือก tag ใหม่ หรือแก้ไขทีหลัง ก็เรียกอันนี้ซ้ำได้เลย) */
export async function syncInterestedIn(user_id: string, username: string, tagNames: string[]) {
  await withNeo4jSession(async (session) => {
    await session.run("MERGE (u:User {user_id: $user_id}) SET u.username = $username", { user_id, username });
    await session.run("MATCH (:User {user_id: $user_id})-[r:INTERESTED_IN]->(:Tag) DELETE r", { user_id });
    for (const name of tagNames) {
      await session.run(
        `MATCH (u:User {user_id: $user_id})
         MERGE (t:Tag {name: $name})
         MERGE (u)-[:INTERESTED_IN]->(t)`,
        { user_id, name }
      );
    }
  });
}

/** แทนที่ HAS_TAG ทั้งหมดของนิยายเรื่องนี้ด้วยชุด tag ปัจจุบัน */
export async function syncNovelTags(novel_id: string, title: string, tagNames: string[]) {
  await withNeo4jSession(async (session) => {
    await session.run("MERGE (n:Novel {novel_id: $novel_id}) SET n.title = $title", { novel_id, title });
    await session.run("MATCH (:Novel {novel_id: $novel_id})-[r:HAS_TAG]->(:Tag) DELETE r", { novel_id });
    for (const name of tagNames) {
      await session.run(
        `MATCH (n:Novel {novel_id: $novel_id})
         MERGE (t:Tag {name: $name})
         MERGE (n)-[:HAS_TAG]->(t)`,
        { novel_id, name }
      );
    }
  });
}

/**
 * upsert ความสัมพันธ์ READ — เรียกตอนมีรีวิว (novel-scoped) เกิดขึ้น สร้าง edge ไว้ก่อนแม้
 * sentiment_score จะยังไม่รู้ (เป็น null ตอน insert แรกเสมอ ดู novels.service.ts createReview) —
 * Phase 7 (Python NLP Worker) จะเรียกอันนี้ซ้ำอีกครั้งพร้อม sentiment_score จริงหลังวิเคราะห์เสร็จ
 * เพื่ออัปเดต edge เดิม (ไม่ใช่สร้างซ้ำ เพราะ MERGE บน (u)-[:READ]->(n) คู่เดิม)
 */
export async function syncReadEdge(user_id: string, novel_id: string, sentiment_score: number | null) {
  await withNeo4jSession((session) =>
    session.run(
      // MERGE (ไม่ใช่ MATCH) ทั้ง User และ Novel — ตอนรีวิวถูกสร้าง อาจยังไม่มี node ทั้งสองใน
      // Neo4j เลยก็ได้ (เช่น user ยังไม่เคยตั้ง interests, นิยายยังไม่มี tag) MATCH ตรง ๆ จะ
      // ล้มเหลวเงียบ ๆ (0 rows, ไม่ throw) ทำให้ edge ไม่ถูกสร้างเลย — พบจากการทดสอบ
      // sentiment-callback path จริงใน Phase 7 (ต่างจาก fullResync ที่สร้าง node ไว้ก่อนหน้าแล้ว)
      `MERGE (u:User {user_id: $user_id})
       MERGE (n:Novel {novel_id: $novel_id})
       MERGE (u)-[r:READ]->(n)
       FOREACH (_ IN CASE WHEN $sentiment_score IS NOT NULL THEN [1] ELSE [] END |
         SET r.sentiment_score = $sentiment_score
       )`,
      { user_id, novel_id, sentiment_score }
    )
  );
}
