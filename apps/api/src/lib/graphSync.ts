import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Session } from "neo4j-driver";
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

/**
 * เพิ่มภายหลัง (graph self-heal) — sync แต่ละจุดเป็นแบบเรียลไทม์อยู่แล้ว แต่ถ้า Neo4j ล่ม/ต่อไม่ได้ตอนนั้น
 * ผู้เรียก catch แล้ว log ทิ้ง ข้อมูลส่วนนั้นจะหายจากกราฟจนกว่า full resync รอบ 6 ชม. จะมาถึง
 * ตอนนี้ทุกการเขียนที่ล้มจะ "ตั้งธง dirty" ไว้ แล้วงาน recommendations-heal (scheduler ทุก ~1 นาที)
 * จะรัน full resync ให้เองทันทีที่ Neo4j กลับมา — ธงเก็บเป็นไฟล์ใน temp ด้วย ไม่หายตอน tsx watch รีสตาร์ท
 */
const dirtyFlagPath = path.join(os.tmpdir(), `buddybook-graph-dirty-${process.env.PORT ?? "4000"}`);
let graphDirty = existsSync(dirtyFlagPath);

export function markGraphDirty() {
  if (graphDirty) return;
  graphDirty = true;
  try {
    writeFileSync(dirtyFlagPath, new Date().toISOString());
  } catch {
    // เขียนไฟล์ไม่ได้ก็ยังมีธงในหน่วยความจำ
  }
}

export function isGraphDirty() {
  return graphDirty;
}

function clearGraphDirty() {
  graphDirty = false;
  try {
    if (existsSync(dirtyFlagPath)) unlinkSync(dirtyFlagPath);
  } catch {
    // ไม่เป็นไร รอบหน้า resync ซ้ำได้ (idempotent)
  }
}

/** ทุกการเขียนกราฟผ่านตัวนี้ — ล้มเมื่อไหร่ตั้งธง dirty แล้วโยน error ต่อให้ผู้เรียก log เหมือนเดิม */
async function writeGraph<T>(work: (session: Session) => Promise<T>): Promise<T> {
  try {
    return await withNeo4jSession(work);
  } catch (err) {
    markGraphDirty();
    throw err;
  }
}

/** งาน scheduler — ถ้ามี sync ที่ล้มค้างอยู่ รัน full resync หนึ่งครั้ง (ไม่มีอะไรค้างคืน null = ไม่ log) */
export async function healGraphIfDirty(): Promise<{ healed: true } | null> {
  if (!graphDirty) return null;
  const { verifyNeo4jConnectivity } = await import("@/lib/neo4j");
  await verifyNeo4jConnectivity(); // ยังต่อไม่ได้ → throw, scheduler log เตือน แล้วลองใหม่รอบหน้า
  const { fullResync } = await import("@/modules/recommendations/recommendations.service");
  clearGraphDirty(); // เคลียร์ก่อนรัน — ถ้าระหว่าง resync มีการเขียนล้มอีก ธงจะถูกตั้งใหม่
  try {
    await fullResync();
  } catch (err) {
    markGraphDirty();
    throw err;
  }
  return { healed: true };
}

/** เพิ่มภายหลัง (audit fix — ลบบัญชี user) — Neo4j เป็น derived store ไม่มี FK/cascade
 *  แบบ Postgres เอง ถ้าไม่ลบ node นี้ตอน user ลบบัญชี จะกลายเป็น "node ผี" ค้างอยู่ในกราฟตลอดไป
 *  ไม่มีทาง Postgres มาบอกได้อีกว่าควรลบ (ไม่มี foreign key ข้ามระบบ) — DETACH DELETE ลบทั้ง node
 *  และทุก edge ที่ต่อกับมัน (INTERESTED_IN, READ ทั้งสองทิศทาง) ในคำสั่งเดียว ปลอดภัยเพราะข้อมูล
 *  ความสนใจ/ประวัติการอ่านเป็นของ user คนนั้นล้วน ๆ ไม่กระทบข้อมูลของคนอื่นในกราฟเลย */
export async function deleteUserGraphNode(user_id: string) {
  await writeGraph((session) =>
    session.run("MATCH (u:User {user_id: $user_id}) DETACH DELETE u", { user_id })
  );
}

export async function syncUserNode(user_id: string, username: string) {
  await writeGraph((session) =>
    session.run("MERGE (u:User {user_id: $user_id}) SET u.username = $username", { user_id, username })
  );
}

export async function syncNovelNode(novel_id: string, title: string) {
  await writeGraph((session) =>
    session.run("MERGE (n:Novel {novel_id: $novel_id}) SET n.title = $title", { novel_id, title })
  );
}

/** แทนที่ INTERESTED_IN ทั้งหมดของ user คนนี้ด้วยชุด tag ปัจจุบัน — idempotent เรียกซ้ำได้ปลอดภัย
 *  (ตอน onboarding เลือก tag ใหม่ หรือแก้ไขทีหลัง ก็เรียกอันนี้ซ้ำได้เลย) */
export async function syncInterestedIn(user_id: string, username: string, tagNames: string[]) {
  await writeGraph(async (session) => {
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
  await writeGraph(async (session) => {
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
 * upsert ความสัมพันธ์ READ — gap 2.2: เดิมสร้างจากรีวิวอย่างเดียว ตอนนี้สร้างตั้งแต่เปิดอ่านตอนแรก
 * (chapters.service recordReadingProgress) เพื่อให้ `NOT (u)-[:READ]->(n)` กรองเรื่องที่อ่านแล้วได้จริง
 *
 * sentiment_score บน edge = ขั้วความรู้สึก −1..1 (รวมรีวิว+คอมเมนต์ ดู lib/sentiment.ts) ไม่ใช่ความมั่นใจ
 * ของโมเดล — null = ไม่แตะค่าเดิม (การอ่านเฉย ๆ ไม่ควรล้างคะแนนที่วิเคราะห์ไว้แล้ว)
 * progress (ไม่บังคับ) เก็บตอนล่าสุดที่อ่าน/เวลา ใช้เป็นสัญญาณ engagement ตอนจัดอันดับ
 */
export async function syncReadEdge(
  user_id: string,
  novel_id: string,
  sentiment_score: number | null,
  progress?: { last_chapter_number: number; last_read_at: Date }
) {
  await writeGraph((session) =>
    session.run(
      // MERGE (ไม่ใช่ MATCH) ทั้ง User และ Novel — ตอนรีวิวถูกสร้าง อาจยังไม่มี node ทั้งสองใน
      // Neo4j เลยก็ได้ (เช่น user ยังไม่เคยตั้ง interests, นิยายยังไม่มี tag) MATCH ตรง ๆ จะ
      // ล้มเหลวเงียบ ๆ (0 rows, ไม่ throw) ทำให้ edge ไม่ถูกสร้างเลย
      `MERGE (u:User {user_id: $user_id})
       MERGE (n:Novel {novel_id: $novel_id})
       MERGE (u)-[r:READ]->(n)
       FOREACH (_ IN CASE WHEN $sentiment_score IS NOT NULL THEN [1] ELSE [] END |
         SET r.sentiment_score = $sentiment_score
       )
       FOREACH (_ IN CASE WHEN $last_chapter_number IS NOT NULL THEN [1] ELSE [] END |
         SET r.last_chapter_number = $last_chapter_number, r.last_read_at = datetime($last_read_at)
       )`,
      {
        user_id,
        novel_id,
        sentiment_score,
        last_chapter_number: progress?.last_chapter_number ?? null,
        last_read_at: progress?.last_read_at.toISOString() ?? null,
      }
    )
  );
}

/** gap 2.4 — นิยายถูกย้ายลงถังขยะ/ลบถาวร: เอาออกจากกราฟ (ไม่ให้ถูกแนะนำอีก) */
export async function deleteNovelGraphNode(novel_id: string) {
  await writeGraph((session) =>
    session.run("MATCH (n:Novel {novel_id: $novel_id}) DETACH DELETE n", { novel_id })
  );
}
