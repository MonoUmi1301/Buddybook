/**
 * BuddyBook — ข้อมูลสำหรับเทสต์ end-to-end (Playwright, ../../e2e) และภาพหน้าจอประกอบรายงาน
 *
 * สร้าง: นักเขียน e2e ที่ล็อกอินได้จริง (มีความสนใจแล้ว ข้าม onboarding ได้) + นิยาย 1 เรื่อง + ตอนที่ 1
 * รันซ้ำได้: ลบผู้ใช้ @e2e.buddybook.local ชุดเดิมก่อนสร้างใหม่
 *
 *   npx tsx prisma/seed-e2e.ts
 *   ล็อกอิน: e2e_writer@e2e.buddybook.local / e2e12345
 *
 * พิมพ์ JSON { novel_id, chapter_id } ออกทาง stdout บรรทัดสุดท้าย ให้สคริปต์อื่นอ่านต่อได้
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DOMAIN = "e2e.buddybook.local";
export const E2E_WRITER = { email: `e2e_writer@${DOMAIN}`, password: "e2e12345" };

async function main() {
  const old = await prisma.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { user_id: true } });
  const oldIds = old.map((u) => u.user_id);
  if (oldIds.length) {
    await prisma.supportTicket.deleteMany({ where: { user_id: { in: oldIds } } });
    await prisma.supportMessage.deleteMany({ where: { author_id: { in: oldIds } } });
    await prisma.comment.deleteMany({ where: { user_id: { in: oldIds } } });
    await prisma.review.deleteMany({ where: { user_id: { in: oldIds } } });
    await prisma.chapterVersion.deleteMany({ where: { edited_by: { in: oldIds } } });
    await prisma.novel.deleteMany({ where: { author_id: { in: oldIds } } });
    await prisma.user.deleteMany({ where: { user_id: { in: oldIds } } });
  }

  const genre = await prisma.tag.findFirst({ where: { category: "genre", parent_tag_id: null }, select: { tag_id: true } });
  const writer = await prisma.user.create({
    data: {
      username: "e2e_writer",
      pen_name: "นักเขียนทดสอบ",
      email: E2E_WRITER.email,
      password_hash: await bcrypt.hash(E2E_WRITER.password, 10),
      age_verified: true,
      ...(genre ? { user_interests: { create: { tag_id: genre.tag_id } } } : {}),
    },
    select: { user_id: true },
  });

  const novel = await prisma.novel.create({
    data: {
      author_id: writer.user_id,
      title: "บันทึกที่ไม่มีวันหาย",
      synopsis: "นิยายสำหรับทดสอบระบบบันทึกอัตโนมัติ",
      visibility: "published",
      ...(genre ? { primary_tag_id: genre.tag_id } : {}),
    },
    select: { novel_id: true },
  });
  const chapter = await prisma.chapter.create({
    data: {
      novel_id: novel.novel_id,
      chapter_number: 1,
      title: "ตอนที่ไฟดับ",
      content: "<p>ย่อหน้าแรกที่บันทึกไว้แล้ว</p>",
      status: "draft",
      updated_at: new Date(),
    },
    select: { chapter_id: true },
  });

  if (process.argv.includes("--rich")) await seedShowcase(writer.user_id, novel.novel_id, genre?.tag_id);

  console.log(JSON.stringify({ writer_id: writer.user_id, novel_id: novel.novel_id, chapter_id: chapter.chapter_id }));
}

/**
 * --rich: ข้อมูลประกอบภาพหน้าจอ — ตอนที่เผยแพร่ 6 ตอน, ผู้อ่าน 12 คน (อ่านไกลไม่เท่ากัน), ยอดวิว 30 วัน,
 * คอมเมนต์/รีวิวพร้อมผล sentiment, เรื่องแจ้งปัญหาที่ทีมงานตอบแล้ว, การแจ้งเตือนหลายประเภท, นิยายในถังขยะ
 */
async function seedShowcase(writer_id: string, novel_id: string, tag_id?: number) {
  const DAY = 86_400_000;
  const titles = ["คืนที่ไฟดับ", "จดหมายฉบับแรก", "เสียงจากห้องใต้หลังคา", "นัดพบที่สถานี", "ความลับของยาย", "รุ่งสาง"];
  const chapters = [];
  for (let i = 0; i < titles.length; i++) {
    chapters.push(
      await prisma.chapter.create({
        data: { novel_id, chapter_number: i + 2, title: titles[i], content: `<p>${titles[i]}</p>`, status: "published", published_at: new Date(Date.now() - (40 - i * 6) * DAY) },
        select: { chapter_id: true, chapter_number: true },
      })
    );
  }

  const hash = await bcrypt.hash("e2e12345", 10);
  const readers = [];
  for (let i = 1; i <= 12; i++) {
    readers.push(
      await prisma.user.create({
        data: { username: `e2e_reader${i}`, email: `e2e_reader${i}@${DOMAIN}`, password_hash: hash, ...(tag_id ? { user_interests: { create: { tag_id } } } : {}) },
        select: { user_id: true },
      })
    );
  }
  // อ่านไกลไม่เท่ากัน — กราฟ retention จะเห็นคนหลุดช่วงกลางเรื่อง
  const reach = [7, 7, 7, 6, 6, 5, 4, 4, 3, 3, 2, 2];
  for (let i = 0; i < readers.length; i++) {
    await prisma.readingProgress.create({ data: { user_id: readers[i].user_id, novel_id, last_chapter_number: reach[i] } });
  }

  let total = 0;
  for (let d = 0; d < 90; d++) {
    const day = new Date(Date.now() - d * DAY).toISOString().slice(0, 10);
    for (const c of chapters) {
      const base = Math.max(0, Math.round(18 - c.chapter_number * 2 + 6 * Math.sin((d + c.chapter_number) / 3) + (d < 10 ? 6 : 0) - d / 8));
      if (base === 0) continue;
      total += base;
      await prisma.chapterViewDaily.create({ data: { chapter_id: c.chapter_id, novel_id, day: new Date(day), views: base } });
    }
  }
  await prisma.novel.update({ where: { novel_id }, data: { view_count: total } });

  const feedback: [number, string, "pos" | "neg" | "neutral", number, number][] = [
    [0, "พล็อตสนุกมาก ตัวละครน่ารักทุกตัว", "pos", 0.96, 3],
    [1, "ชอบสำนวนการบรรยาย อ่านแล้วเห็นภาพ", "pos", 0.91, 6],
    [2, "ตอนนี้ยืดเยื้อไปหน่อย น่าเบื่อนิดนึง", "neg", 0.84, 9],
    [3, "พล็อตหักมุมดีมาก รอตอนต่อไปเลย", "pos", 0.93, 12],
    [4, "นางเอกน่ารัก แต่ตอนนี้สั้นไป", "neutral", 0.7, 16],
    [5, "พล็อตตอนกลางเรื่องยืดเยื้อ อ่านแล้วน่าเบื่อ", "neg", 0.8, 20],
    [6, "สนุก ฟินมาก ตัวละครมีมิติ", "pos", 0.95, 25],
    [7, "ภาษาสวย บรรยายดี สนุกมาก", "pos", 0.9, 30],
    [8, "มีคำผิดหลายจุด แต่พล็อตสนุก", "neutral", 0.66, 38],
    [9, "ตัวร้ายน่ากลัวดี ชอบพล็อต", "pos", 0.88, 45],
  ];
  for (const [r, text, label, conf, ago] of feedback) {
    const polarity = label === "pos" ? conf : label === "neg" ? -conf : 0;
    await prisma.comment.create({
      data: {
        chapter_id: chapters[r % chapters.length].chapter_id,
        user_id: readers[r].user_id,
        content: text,
        sentiment_label: label,
        sentiment_score: conf,
        sentiment_polarity: polarity,
        created_at: new Date(Date.now() - ago * DAY),
      },
    });
  }
  for (const [r, rating, text, label, pol] of [
    [0, 5, "สนุกมาก แนะนำเลย", "pos", 0.94],
    [1, 4, "พล็อตดี แต่บางตอนยืดเยื้อ", "neutral", 0],
    [3, 5, "ตัวละครน่ารัก ฟินมาก", "pos", 0.92],
  ] as const) {
    await prisma.review.create({
      data: { novel_id, user_id: readers[r].user_id, rating, comment_text: text, sentiment_label: label, sentiment_score: Math.abs(pol) || 0.7, sentiment_polarity: pol },
    });
  }
  for (const r of readers.slice(0, 7)) await prisma.novelLike.create({ data: { user_id: r.user_id, novel_id } });
  for (const r of readers.slice(0, 9)) await prisma.userLibrary.create({ data: { user_id: r.user_id, novel_id, status: "reading" } });

  // เรื่องแจ้งปัญหา (ทีมงานตอบแล้ว) + การแจ้งเตือน
  const admin = await prisma.user.create({
    data: { username: "e2e_admin", email: `e2e_admin@${DOMAIN}`, password_hash: hash, role: "admin" },
    select: { user_id: true },
  });
  const ticket = await prisma.supportTicket.create({
    data: {
      user_id: writer_id,
      category: "payment",
      subject: "เติมเงินผ่าน PromptPay แล้วเหรียญไม่เข้า",
      status: "in_progress",
      messages: {
        create: [
          { author_id: writer_id, body: "โอน 100 บาทเมื่อ 10:24 น. สถานะในหน้ากระเป๋าเงินยังเป็นรอตรวจสอบค่ะ", created_at: new Date(Date.now() - 2 * 3_600_000) },
          { author_id: admin.user_id, is_staff: true, body: "ได้รับเรื่องแล้วค่ะ กำลังตรวจสอบกับธนาคาร จะแจ้งผลภายในวันนี้", created_at: new Date(Date.now() - 3_600_000) },
        ],
      },
    },
    select: { ticket_id: true },
  });
  await prisma.supportTicket.create({
    data: {
      user_id: writer_id,
      category: "bug",
      subject: "แผนที่โลกนิยายซูมบนไอแพดไม่ได้",
      status: "resolved",
      updated_at: new Date(Date.now() - 5 * DAY),
      messages: { create: [{ author_id: writer_id, body: "ใช้ iPad Safari ซูมแผนที่ด้วยสองนิ้วแล้วหน้าเว็บซูมแทนค่ะ" }] },
    },
  });
  await prisma.notification.createMany({
    data: [
      { user_id: writer_id, type: "support_reply", content: 'ทีมงานตอบกลับเรื่อง "เติมเงินผ่าน PromptPay แล้วเหรียญไม่เข้า" แล้ว', link_url: `/support/${ticket.ticket_id}`, created_at: new Date(Date.now() - 3_600_000) },
      { user_id: writer_id, type: "comment", content: "e2e_reader4 คอมเมนต์ในตอน \"นัดพบที่สถานี\"", link_url: `/novels/${novel_id}`, created_at: new Date(Date.now() - 5 * 3_600_000) },
      { user_id: writer_id, type: "new_follower", content: "e2e_reader7 เริ่มติดตามคุณ", created_at: new Date(Date.now() - DAY) },
      { user_id: writer_id, type: "donation", content: "e2e_reader1 ส่งของขวัญ ช่อดอกไม้ ให้คุณ", is_read: true, created_at: new Date(Date.now() - 2 * DAY) },
      { user_id: writer_id, type: "new_chapter", content: 'นิยาย "เงาของสายลมเดือนสิบ" มีตอนใหม่: ตอนที่ 33', is_read: true, created_at: new Date(Date.now() - 3 * DAY) },
      { user_id: writer_id, type: "system", content: "ระบบแนะนำนิยายรุ่นใหม่เปิดใช้งานแล้ว นิยายใหม่มีโอกาสถูกค้นพบมากขึ้น", is_read: true, created_at: new Date(Date.now() - 6 * DAY) },
    ],
  });

  // นิยายในถังขยะ (หน้า "นิยายที่ถูกลบ")
  await prisma.novel.create({
    data: {
      author_id: writer_id,
      title: "ร่างแรกที่ยังไม่ลงตัว",
      visibility: "private",
      visibility_before_delete: "private",
      deleted_at: new Date(Date.now() - 26 * DAY),
      chapters: { create: [{ chapter_number: 1, title: "เริ่ม", content: "<p>x</p>" }] },
    },
  });
  await prisma.novel.create({
    data: { author_id: writer_id, title: "เมืองใต้เงาจันทร์ (ฉบับเก่า)", visibility: "private", visibility_before_delete: "published", deleted_at: new Date(Date.now() - 3 * DAY) },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
