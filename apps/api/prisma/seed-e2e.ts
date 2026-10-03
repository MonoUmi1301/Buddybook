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

  console.log(JSON.stringify({ writer_id: writer.user_id, novel_id: novel.novel_id, chapter_id: chapter.chapter_id }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
