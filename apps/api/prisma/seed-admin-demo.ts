/**
 * ข้อมูลตัวอย่างสำหรับหน้าหลังบ้าน (/admin) — ให้แต่ละเมนูมีรายการให้ลองกดจัดการ ไม่ว่างเปล่า
 * ใช้ผู้ใช้/นิยาย/คอมเมนต์ที่มีอยู่แล้วในฐานข้อมูล (จาก seed ปกติ) ไม่สร้างผู้ใช้ใหม่
 *
 *   npx tsx prisma/seed-admin-demo.ts          ← เพิ่มข้อมูลตัวอย่าง
 *   npx tsx prisma/seed-admin-demo.ts --clean  ← ลบข้อมูลตัวอย่างชุดนี้ออกทั้งหมด
 *
 * ทุกแถวที่สร้างมีคำว่า "(ข้อมูลตัวอย่าง)" กำกับ เพื่อให้ --clean ลบได้ถูกตัว และไม่ปนกับข้อมูลจริง
 * ต้องมีบัญชีแอดมินก่อน (npx tsx prisma/create-admin.ts)
 */
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MARK = "(ข้อมูลตัวอย่าง)";
const DEMO_ACCOUNT = "บัญชีตัวอย่าง";
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

async function clean() {
  const reports = await prisma.contentReport.deleteMany({ where: { details: { endsWith: MARK } } });
  const ticketIds = (
    await prisma.supportMessage.findMany({ where: { body: { endsWith: MARK } }, select: { ticket_id: true } })
  ).map((m) => m.ticket_id);
  const tickets = await prisma.supportTicket.deleteMany({ where: { ticket_id: { in: ticketIds } } });
  const wds = await prisma.withdrawalRequest.findMany({ where: { account_name: DEMO_ACCOUNT }, select: { withdrawal_id: true } });
  const wdIds = wds.map((w) => w.withdrawal_id);
  await prisma.walletTransaction.deleteMany({ where: { reference_id: { in: wdIds } } });
  const withdrawals = await prisma.withdrawalRequest.deleteMany({ where: { withdrawal_id: { in: wdIds } } });
  const gifts = await prisma.donation.updateMany({
    where: { report_reason: { endsWith: MARK } },
    data: { reported_at: null, report_reason: null, report_resolved_at: null },
  });
  console.log(
    `✔ ลบข้อมูลตัวอย่างแล้ว — รายงานเนื้อหา ${reports.count}, แจ้งปัญหา ${tickets.count}, ถอนเงิน ${withdrawals.count}, การ์ดถูกรายงาน ${gifts.count}`
  );
}

async function latestBalance(user_id: string): Promise<number> {
  const last = await prisma.walletTransaction.findFirst({
    where: { user_id },
    orderBy: { created_at: "desc" },
    select: { balance_after: true },
  });
  return last ? Number(last.balance_after) : 0;
}

async function main() {
  if (process.argv.includes("--clean")) return clean();

  const admin = await prisma.user.findFirst({ where: { role: "admin", deleted_at: null }, select: { user_id: true } });
  if (!admin) throw new Error("ยังไม่มีบัญชีแอดมิน — รัน npx tsx prisma/create-admin.ts ก่อน");

  const users = await prisma.user.findMany({
    where: { role: "user", deleted_at: null, is_suspended: false },
    select: { user_id: true },
    take: 12,
    orderBy: { created_at: "asc" },
  });
  if (users.length < 4) throw new Error("ผู้ใช้ในฐานข้อมูลน้อยเกินไป — รัน seed ปกติก่อน (npm run db:setup)");
  const u = (i: number) => users[i % users.length].user_id;

  // ---------- 1. รายงานเนื้อหา ----------
  const [novel, chapter, comment, review] = await Promise.all([
    prisma.novel.findFirst({ where: { visibility: "published", deleted_at: null }, orderBy: { view_count: "desc" }, select: { novel_id: true, author_id: true } }),
    prisma.chapter.findFirst({ where: { status: "published" }, orderBy: { created_at: "desc" }, select: { chapter_id: true } }),
    prisma.comment.findFirst({ orderBy: { created_at: "desc" }, select: { comment_id: true } }),
    prisma.review.findFirst({ where: { comment_text: { not: null } }, orderBy: { created_at: "desc" }, select: { review_id: true } }),
  ]);

  const reportRows: Prisma.ContentReportCreateManyInput[] = [];
  if (novel)
    reportRows.push({ reporter_id: u(1), target_type: "novel", target_id: novel.novel_id, reason: "copyright", details: `เนื้อเรื่องช่วงแรกคล้ายนิยายเรื่องอื่นที่เคยอ่านมาก ฝากตรวจสอบด้วยครับ ${MARK}`, created_at: hoursAgo(5) });
  if (chapter)
    reportRows.push({ reporter_id: u(2), target_type: "chapter", target_id: chapter.chapter_id, reason: "inappropriate", details: `ตอนนี้มีฉากรุนแรงแต่นิยายไม่ได้ติดเรต 18+ ${MARK}`, created_at: hoursAgo(9) });
  if (comment)
    reportRows.push({ reporter_id: u(3), target_type: "comment", target_id: comment.comment_id, reason: "harassment", details: `คอมเมนต์นี้พูดจาไม่สุภาพกับนักเขียน ${MARK}`, created_at: hoursAgo(20) });
  if (review)
    reportRows.push({ reporter_id: u(4), target_type: "review", target_id: review.review_id, reason: "spam", details: `รีวิวนี้มีลิงก์โฆษณาแปะไว้ ${MARK}`, created_at: hoursAgo(30) });
  if (novel)
    reportRows.push({
      reporter_id: u(5), target_type: "user", target_id: novel.author_id, reason: "other",
      details: `ผู้ใช้นี้ส่งข้อความชวนไปซื้อของนอกเว็บ ${MARK}`, status: "dismissed",
      admin_note: "ตรวจแล้วไม่พบหลักฐาน", resolved_by: admin.user_id, resolved_at: hoursAgo(48), created_at: hoursAgo(72),
    });
  const reports = await prisma.contentReport.createMany({ data: reportRows, skipDuplicates: true });

  // ---------- 2. แจ้งปัญหา ----------
  const tickets: { user: string; category: "account" | "payment" | "bug" | "content" | "other"; subject: string; status: "open" | "in_progress" | "resolved" | "closed"; messages: { staff?: boolean; body: string; h: number }[] }[] = [
    {
      user: u(0), category: "payment", subject: "เติม coin แล้วยอดไม่เข้า", status: "open",
      messages: [{ body: "โอนเงิน 100 บาทเมื่อชั่วโมงก่อน อัปโหลดสลิปแล้วแต่ coin ยังไม่เข้าค่ะ", h: 2 }],
    },
    {
      user: u(1), category: "bug", subject: "หน้าอ่านนิยายค้างตอนเปลี่ยนตอน", status: "in_progress",
      messages: [
        { body: "กดตอนถัดไปแล้วหน้าขาวไปเลย ต้องรีเฟรชถึงจะขึ้น ใช้ Chrome บนมือถือครับ", h: 26 },
        { staff: true, body: "ขอบคุณที่แจ้งนะคะ ทีมงานกำลังตรวจสอบ รบกวนบอกรุ่นมือถือด้วยค่ะ", h: 20 },
        { body: "Samsung A54 ครับ", h: 18 },
      ],
    },
    {
      user: u(2), category: "account", subject: "เปลี่ยนอีเมลบัญชีได้ไหม", status: "resolved",
      messages: [
        { body: "อยากเปลี่ยนอีเมลที่ใช้ล็อกอิน ต้องทำยังไงคะ", h: 70 },
        { staff: true, body: "เปลี่ยนได้ที่หน้าตั้งค่าบัญชีเลยค่ะ ระบบจะส่งลิงก์ยืนยันไปที่อีเมลใหม่", h: 66 },
      ],
    },
    {
      user: u(3), category: "content", subject: "อยากให้เพิ่มแท็ก 'โรงเรียนเวทมนตร์'", status: "closed",
      messages: [
        { body: "เขียนนิยายแนวโรงเรียนเวทมนตร์ แต่ไม่มีแท็กให้เลือกครับ", h: 120 },
        { staff: true, body: "เพิ่มแท็กให้แล้วค่ะ ลองเลือกในหน้าแก้ไขนิยายได้เลย", h: 100 },
      ],
    },
  ];
  for (const t of tickets) {
    const last = t.messages[t.messages.length - 1];
    await prisma.supportTicket.create({
      data: {
        user_id: t.user, category: t.category, subject: t.subject, status: t.status,
        created_at: hoursAgo(t.messages[0].h), updated_at: hoursAgo(last.h),
        messages: {
          create: t.messages.map((m) => ({
            author_id: m.staff ? admin.user_id : t.user,
            is_staff: !!m.staff,
            body: `${m.body} ${MARK}`,
            created_at: hoursAgo(m.h),
          })),
        },
      },
    });
  }

  // ---------- 3. คำขอถอนเงิน (หัก coin จริงในบัญชีตัวอย่างแบบเดียวกับตอนนักเขียนกดถอน) ----------
  const authors = await prisma.novel.findMany({
    where: { deleted_at: null, author: { role: "user", deleted_at: null } },
    distinct: ["author_id"],
    select: { author_id: true },
    take: 10,
  });
  const wdPlan = [
    { amount: 300, method: "promptpay", status: "pending" as const, h: 3 },
    { amount: 150, method: "bank", status: "pending" as const, h: 15 },
    { amount: 500, method: "bank", status: "paid" as const, h: 96 },
  ];
  let wdCount = 0;
  for (const [i, plan] of wdPlan.entries()) {
    const author = authors[i];
    if (!author) break;
    const hasPending = await prisma.withdrawalRequest.count({ where: { user_id: author.author_id, status: "pending" } });
    if (plan.status === "pending" && hasPending) continue;
    const balance = await latestBalance(author.author_id);
    if (balance < plan.amount) continue; // coin ไม่พอ — ข้าม ไม่ทำให้ยอดติดลบ
    const row = await prisma.withdrawalRequest.create({
      data: {
        user_id: author.author_id,
        amount_coins: plan.amount,
        amount_thb: new Prisma.Decimal(plan.amount),
        payout_method: plan.method,
        account_name: DEMO_ACCOUNT,
        account_number: plan.method === "promptpay" ? "0812345678" : "123-4-56789-0",
        bank_name: plan.method === "bank" ? "ธนาคารตัวอย่าง" : null,
        status: plan.status,
        ...(plan.status === "paid" ? { processed_by: admin.user_id, processed_at: hoursAgo(plan.h - 20), admin_note: `โอนแล้ว ${MARK}` } : {}),
        created_at: hoursAgo(plan.h),
      },
    });
    await prisma.walletTransaction.create({
      data: { user_id: author.author_id, type: "withdrawal", amount: plan.amount, balance_after: balance - plan.amount, reference_id: row.withdrawal_id },
    });
    wdCount++;
  }

  // ---------- 4. การ์ดของขวัญที่ถูกรายงาน ----------
  const donations = await prisma.donation.findMany({
    where: { message: { not: null }, reported_at: null },
    orderBy: { created_at: "desc" },
    take: 2,
    select: { donation_id: true },
  });
  const reasons = ["ข้อความในการ์ดไม่สุภาพ", "ส่งข้อความโฆษณาผ่านการ์ด"];
  for (const [i, d] of donations.entries()) {
    await prisma.donation.update({
      where: { donation_id: d.donation_id },
      data: { reported_at: hoursAgo(4 + i * 6), report_reason: `${reasons[i]} ${MARK}` },
    });
  }

  console.log("✔ เพิ่มข้อมูลตัวอย่างหลังบ้านแล้ว");
  console.log(`  รายงานเนื้อหา ${reports.count} · แจ้งปัญหา ${tickets.length} · ถอนเงิน ${wdCount} · การ์ดถูกรายงาน ${donations.length}`);
  if (wdCount < wdPlan.length) console.log("  (คำขอถอนเงินบางรายการถูกข้าม เพราะนักเขียนมี coin ไม่พอหรือมีคำขอค้างอยู่แล้ว)");
  if (donations.length === 0) console.log("  (ยังไม่มีของขวัญที่มีข้อความในระบบ เมนู 'การ์ดที่ถูกรายงาน' จะยังว่าง)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
