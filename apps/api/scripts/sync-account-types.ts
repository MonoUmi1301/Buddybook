/**
 * ซิงก์ users.account_type (DEMO/REAL) ไปที่ node (:User) ใน Neo4j — เบากว่า graph:resync (แตะแค่ node ผู้ใช้)
 * รันหลัง scripts/mark-demo.ts ทุกครั้ง; graph:resync / scheduler ก็ตั้งค่านี้ให้เหมือนกัน
 *
 *   cd apps/api && npm run graph:sync-accounts
 */
import { syncUserNodesBatch } from "@/lib/graphSync";
import { neo4jDriver, withNeo4jSession } from "@/lib/neo4j";
import { prisma } from "@/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({ select: { user_id: true, username: true, account_type: true } });
  await syncUserNodesBatch(users);

  const rows = await withNeo4jSession((session) =>
    session.run("MATCH (u:User) RETURN coalesce(u.account_type, 'ไม่มีค่า') AS type, count(*) AS c ORDER BY type")
  );
  console.log(`[sync-accounts] ส่ง ${users.length} ผู้ใช้ไป Neo4j แล้ว`);
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
