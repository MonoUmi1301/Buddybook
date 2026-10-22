/**
 * full resync กราฟ Neo4j จาก Postgres (ตัวเดียวกับปุ่มในหลังบ้าน / งาน scheduler) แบบรันจาก terminal
 * ไม่ผูกกับ process ของ API — tsx watch รีสตาร์ทระหว่างทางก็ไม่ทำให้กราฟค้างครึ่ง ๆ
 *
 *   cd apps/api && npm run graph:resync
 *
 * ตรวจผลต่อด้วย `npx tsx --env-file=.env scripts/eval-recommender.ts` (ข้อ 1.1 ต้องตรงทุกรายการ)
 */
import { fullResync } from "@/modules/recommendations/recommendations.service";
import { neo4jDriver } from "@/lib/neo4j";
import { prisma } from "@/lib/prisma";

async function main() {
  const t = Date.now();
  console.log("[resync] เริ่ม full resync ...");
  const result = await fullResync();
  console.log(`[resync] เสร็จใน ${((Date.now() - t) / 1000).toFixed(1)} วินาที`);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error("[resync] ล้มเหลว", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await neo4jDriver.close();
    await prisma.$disconnect();
  });
