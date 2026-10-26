/**
 * ซิงก์ users.account_type (DEMO/REAL) ไปที่ node (:User) ใน Neo4j — เบากว่า graph:resync (แตะแค่ node ผู้ใช้)
 * รันหลัง scripts/mark-demo.ts ทุกครั้ง; graph:resync / scheduler ก็ตั้งค่านี้ให้เหมือนกัน
 * ลบ node (:User) ผีที่ไม่มีใน Postgres แล้วด้วย (ผู้ใช้ที่ถูกลบตอน Neo4j ล่ม ฯลฯ) — ปกติ graph:resync เป็นตัวลบ
 *
 *   cd apps/api; npm run graph:sync-accounts
 */
import { syncUserNodesBatch } from "@/lib/graphSync";
import { neo4jDriver, withNeo4jSession } from "@/lib/neo4j";
import { prisma } from "@/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({ select: { user_id: true, username: true, account_type: true } });
  await syncUserNodesBatch(users);

  // อ่าน id ใหม่ "ตอนนี้" ก่อนลบ (ไม่ใช้ชุดด้านบน) กันลบ node ของคนที่เพิ่งสมัครระหว่างทาง
  const keep = (await prisma.user.findMany({ select: { user_id: true } })).map((u) => u.user_id);
  const pruned = await withNeo4jSession((session) =>
    session.executeWrite((tx) =>
      tx.run("MATCH (u:User) WHERE NOT u.user_id IN $keep DETACH DELETE u RETURN count(*) AS c", { keep })
    )
  );

  const rows = await withNeo4jSession((session) =>
    session.run("MATCH (u:User) RETURN coalesce(u.account_type, 'ไม่มีค่า') AS type, count(*) AS c ORDER BY type")
  );
  console.log(`[sync-accounts] ส่ง ${users.length} ผู้ใช้ไป Neo4j แล้ว · ลบ node ผี ${pruned.records[0].get("c").toString()} รายการ`);
  for (const r of rows.records) console.log(`  (:User) ${String(r.get("type")).padEnd(8)} ${r.get("c").toString()}`);
}

main()
  .catch((err) => {
    console.error("[sync-accounts] ล้มเหลว", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await neo4jDriver.close();
    await prisma.$disconnect();
  });
