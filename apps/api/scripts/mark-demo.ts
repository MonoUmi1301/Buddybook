/**
 * ติดป้ายข้อมูลเดิมว่าเป็นตัวอย่าง (DEMO) หรือผู้ใช้จริง (REAL) — รันหลัง migration 20261026090000_demo_real_accounts
 *
 *   cd apps/api && npm run db:mark-demo              ← เขียนจริง
 *   cd apps/api && npm run db:mark-demo -- --dry-run ← แสดงจำนวนที่จะเปลี่ยน แล้ว rollback
 *
 * กติกา:
 *   - ผู้ใช้ทุกคนยกเว้น REAL_EMAILS → DEMO (REAL_EMAILS → REAL เสมอ)
 *     แตะเฉพาะบัญชีที่สร้างก่อน migration นี้ถูก apply — คนที่สมัครหลังจากนั้นเป็น REAL จาก auth.service
 *     และสคริปต์นี้ไม่ไปเปลี่ยนเขา (รันซ้ำได้ทุกเมื่อ) seed ที่รันทีหลังตั้ง DEMO ให้เองอยู่แล้ว
 *   - เนื้อหา is_demo = ผู้สร้างเป็น DEMO หรือไม่ (ตามผู้สร้าง ไม่ใช่ตามนิยาย — คนจริงรีวิวนิยาย DEMO ก็ยัง false)
 *     ตอน → นักเขียนของนิยาย, คอมเมนต์/รีวิว/ถูกใจ/ซื้อตอน → ผู้ใช้, โดเนท/ของขวัญ → ผู้ให้
 *   ทั้งหมดอยู่ใน transaction เดียว พิมพ์จำนวนแถวที่เปลี่ยนจริงในแต่ละตาราง (รันซ้ำได้ ครั้งที่สองควรเป็น 0)
 *
 * สำรองฐานข้อมูลก่อนรันบนเครื่องจริง: npm run db:backup (จาก root)
 */
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REAL_EMAILS = ["monoumi.m@gmail.com", "hobikawaiidesu@gmail.com", "admin@buddybook.local"];
const MIGRATION = "20261026090000_demo_real_accounts";
const dryRun = process.argv.includes("--dry-run");

/** ตาราง → SQL หาผู้สร้างของแต่ละแถว (alias t = ตารางนั้น, ต้องคืน user_id ของผู้สร้าง) */
const CONTENT: { table: string; creator: Prisma.Sql }[] = [
  { table: "novels", creator: Prisma.sql`t.author_id` },
  { table: "chapters", creator: Prisma.sql`(SELECT n.author_id FROM novels n WHERE n.novel_id = t.novel_id)` },
  { table: "comments", creator: Prisma.sql`t.user_id` },
  { table: "reviews", creator: Prisma.sql`t.user_id` },
  { table: "donations", creator: Prisma.sql`t.from_user_id` },
  { table: "novel_likes", creator: Prisma.sql`t.user_id` },
  { table: "chapter_purchases", creator: Prisma.sql`t.user_id` },
];

class DryRunRollback extends Error {}

async function main() {
  const [migration] = await prisma.$queryRaw<{ finished_at: Date | null }[]>`
    SELECT finished_at FROM _prisma_migrations WHERE migration_name = ${MIGRATION} AND rolled_back_at IS NULL`;
  if (!migration?.finished_at) throw new Error(`ยังไม่ได้ apply migration ${MIGRATION} — รัน npx prisma migrate deploy ก่อน`);
  const cutoff = migration.finished_at;

  const counts: Record<string, string> = {};
  try {
    await prisma.$transaction(
      async (tx) => {
        const toReal = await tx.$executeRaw`
          UPDATE users SET account_type = 'REAL'
          WHERE lower(email) IN (${Prisma.join(REAL_EMAILS)}) AND account_type <> 'REAL'`;
        const toDemo = await tx.$executeRaw`
          UPDATE users SET account_type = 'DEMO'
          WHERE lower(email) NOT IN (${Prisma.join(REAL_EMAILS)}) AND account_type <> 'DEMO' AND created_at < ${cutoff}`;
        counts.users = `${toDemo} → DEMO, ${toReal} → REAL`;

        for (const { table, creator } of CONTENT) {
          const t = Prisma.raw(`"${table}"`);
          const isDemo = Prisma.sql`COALESCE((SELECT u.account_type = 'DEMO' FROM users u WHERE u.user_id = ${creator}), false)`;
          const changed = await tx.$queryRaw<{ to_demo: bigint; to_real: bigint }[]>`
            WITH updated AS (
              UPDATE ${t} AS t SET is_demo = ${isDemo}
              WHERE t.is_demo IS DISTINCT FROM ${isDemo}
              RETURNING t.is_demo
            )
            SELECT count(*) FILTER (WHERE is_demo) AS to_demo, count(*) FILTER (WHERE NOT is_demo) AS to_real FROM updated`;
          counts[table] = `${changed[0].to_demo} → true, ${changed[0].to_real} → false`;
        }

        if (dryRun) throw new DryRunRollback();
      },
      { timeout: 10 * 60 * 1000 }
    );
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }

  const [summary] = await prisma.$queryRaw<{ real: bigint; demo: bigint }[]>`
    SELECT count(*) FILTER (WHERE account_type = 'REAL') AS real, count(*) FILTER (WHERE account_type = 'DEMO') AS demo FROM users`;

  console.log(`${dryRun ? "[dry-run — rollback แล้ว ไม่มีอะไรถูกเขียน] " : ""}mark-demo (บัญชีที่สร้างก่อน ${cutoff.toISOString()})`);
  for (const [table, c] of Object.entries(counts)) console.log(`  ${table.padEnd(18)} ${c}`);
  console.log(`ผู้ใช้ทั้งหมดตอนนี้: REAL ${summary.real} · DEMO ${summary.demo}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
