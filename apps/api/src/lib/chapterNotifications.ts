import { prisma } from "@/lib/prisma";

interface NewChapterInfo {
  chapter_id: string;
  chapter_number: number;
  title: string;
}

/** เพิ่มภายหลัง (audit fix) — แจ้งเตือนผู้อ่านที่เก็บนิยายไว้ในชั้นหนังสือ (UserLibrary) และผู้ติดตามนักเขียน ทุกครั้งที่
 *  มีตอนใหม่เผยแพร่จริง เรียกจาก 3 จุดที่ตอนกลายเป็น published: chapters.service.ts createChapter
 *  (เผยแพร่ทันทีตอนสร้าง), updateChapter (แก้สถานะ draft/scheduled -> published), และ
 *  internal.service.ts publishScheduledChapters (cron flip ตอนที่ตั้งเวลาไว้) — ใช้ createMany()
 *  ยิงทีเดียวแทนวนลูป .create() ทีละแถว กันนิยายดังที่มีคนเก็บเป็นพันคนทำให้ query ช้า/timeout
 *  ไม่แจ้งเตือนผู้เขียนเอง (กันกรณีผู้เขียนเก็บนิยายตัวเองไว้ในชั้นหนังสือด้วย) */
export async function notifyLibraryOfNewChapter(
  novel_id: string,
  author_id: string,
  chapter: NewChapterInfo
): Promise<void> {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { title: true, visibility: true } });
  // นิยาย private/รอตรวจ ผู้อ่านเปิดลิงก์ไม่ได้อยู่แล้ว — ไม่แจ้งเตือน (กันชื่อเรื่อง/ตอนหลุดไปหาผู้ติดตาม)
  if (!novel || novel.visibility !== "published") return;

  // เพิ่มภายหลัง (ติดตามนักเขียน) — รวมผู้ติดตามนักเขียนด้วย ตัดคนซ้ำ (เก็บในชั้นหนังสือ + ติดตาม = แจ้งครั้งเดียว)
  const [libraryRows, followerRows] = await Promise.all([
    prisma.userLibrary.findMany({ where: { novel_id, user_id: { not: author_id } }, select: { user_id: true } }),
    prisma.authorFollow.findMany({ where: { author_id }, select: { follower_id: true } }),
  ]);
  const subscribers = new Set([...libraryRows.map((r) => r.user_id), ...followerRows.map((r) => r.follower_id)]);
  subscribers.delete(author_id);
  if (subscribers.size === 0) return;

  await prisma.notification.createMany({
    data: [...subscribers].map((user_id) => ({
      user_id,
      type: "new_chapter" as const,
      content: `นิยาย "${novel.title}" อัปเดตตอนใหม่: ตอนที่ ${chapter.chapter_number} ${chapter.title}`,
      link_url: `/novels/${novel_id}/chapters/${chapter.chapter_id}`,
    })),
  });
}
