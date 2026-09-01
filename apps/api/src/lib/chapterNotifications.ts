import { prisma } from "@/lib/prisma";

interface NewChapterInfo {
  chapter_id: string;
  chapter_number: number;
  title: string;
}

/** เพิ่มภายหลัง (audit fix) — แจ้งเตือนผู้อ่านที่เก็บนิยายไว้ในชั้นหนังสือ (UserLibrary) ทุกครั้งที่
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
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { title: true } });
  if (!novel) return;

  const subscribers = await prisma.userLibrary.findMany({
    where: { novel_id, user_id: { not: author_id } },
    select: { user_id: true },
  });
  if (subscribers.length === 0) return;

  await prisma.notification.createMany({
    data: subscribers.map((s) => ({
      user_id: s.user_id,
      type: "new_chapter" as const,
      content: `นิยาย "${novel.title}" อัปเดตตอนใหม่: ตอนที่ ${chapter.chapter_number} ${chapter.title}`,
      link_url: `/novels/${novel_id}/chapters/${chapter.chapter_id}`,
    })),
  });
}
