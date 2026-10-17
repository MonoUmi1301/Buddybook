/**
 * ข้อมูลตั้งต้นของ e2e/core-flows.spec.ts (ฟีเจอร์แกนของงานวิจัย: นักเขียน / ถังขยะ / ผู้อ่าน+sentiment /
 * ตอนติดเหรียญ+ถอนรายได้ / ซัพพอร์ต / อายุ) — แยกจาก seed-e2e.ts ที่ใช้กับเทสต์ auto-save
 *
 *   npx tsx prisma/seed-e2e-core.ts   → พิมพ์ JSON ของ id ผู้ใช้บรรทัดสุดท้าย
 *
 * รันซ้ำได้: ลบผู้ใช้ @e2e-core.buddybook.local ชุดเดิม (และทุกอย่างที่ผูกกับพวกเขา) ก่อนสร้างใหม่
 * รหัสผ่านทุกบัญชี: e2e12345 (บัญชีทดสอบในเครื่องเท่านั้น)
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DOMAIN = "e2e-core.buddybook.local";
const PASSWORD = "e2e12345";
const READER_START_COINS = 1000;

async function cleanup() {
  const old = await prisma.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { user_id: true } });
  const ids = old.map((u) => u.user_id);
  if (!ids.length) return;
  const mine = { in: ids };
  const novels = await prisma.novel.findMany({ where: { author_id: mine }, select: { novel_id: true } });
  const novelIds = { in: novels.map((n) => n.novel_id) };

  // ลำดับตาม FK ที่ไม่ cascade (ดู schema.prisma): ledger/คำขอถอน/ของขวัญ/คอมเมนต์/รีวิว/เวอร์ชัน/ถังขยะ ก่อนตัวผู้ใช้
  await prisma.withdrawalRequest.deleteMany({ where: { user_id: mine } });
  await prisma.walletTransaction.deleteMany({ where: { user_id: mine } });
  await prisma.donation.deleteMany({ where: { OR: [{ from_user_id: mine }, { to_user_id: mine }] } });
  await prisma.supportMessage.deleteMany({ where: { OR: [{ author_id: mine }, { ticket: { user_id: mine } }] } });
  await prisma.supportTicket.deleteMany({ where: { user_id: mine } });
  await prisma.comment.deleteMany({ where: { OR: [{ user_id: mine }, { chapter: { novel_id: novelIds } }] } });
  await prisma.review.deleteMany({ where: { OR: [{ user_id: mine }, { novel_id: novelIds }] } });
  await prisma.chapterVersion.deleteMany({ where: { OR: [{ edited_by: mine }, { chapter: { novel_id: novelIds } }] } });
  await prisma.trashBin.deleteMany({ where: { OR: [{ deleted_by: mine }, { novel_id: novelIds }] } });
  await prisma.novel.deleteMany({ where: { author_id: mine } });
  await prisma.user.deleteMany({ where: { user_id: mine } });
}

async function main() {
  await cleanup();

  const genre = await prisma.tag.findFirst({ where: { category: "genre", parent_tag_id: null }, select: { tag_id: true } });
  const password_hash = await bcrypt.hash(PASSWORD, 10);
  const interests = genre ? { user_interests: { create: { tag_id: genre.tag_id } } } : {};

  const make = (username: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({
      data: { username, email: `${username}@${DOMAIN}`, password_hash, ...interests, ...extra },
      select: { user_id: true, email: true },
    });

  const writer = await make("core_writer", { pen_name: "นักเขียนแกนหลัก", age_verified: true, age_verification_source: "self_declared" });
  const reader = await make("core_reader", { age_verified: true, age_verification_source: "self_declared" });
  const minor = await make("core_minor", { age_verified: false, age_verification_source: "self_declared" });
  const admin = await make("core_admin", { role: "admin", age_verified: true });

  // เติมเหรียญตั้งต้นให้ผู้อ่าน (ledger แบบเดียวกับ top-up จริง — balance_after คือยอดล่าสุด)
  await prisma.walletTransaction.create({
    data: { user_id: reader.user_id, type: "topup", amount: READER_START_COINS, balance_after: READER_START_COINS },
  });

  console.log(
    JSON.stringify({
      password: PASSWORD,
      genre_tag_id: genre?.tag_id ?? null,
      writer,
      reader,
      minor,
      admin,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
