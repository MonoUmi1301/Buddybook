import { prisma } from "@/lib/prisma";
import { refreshReadEdgeSentiment, toPolarity } from "@/lib/sentiment";
import { notifyLibraryOfNewChapter } from "@/lib/chapterNotifications";
import { purgeExpiredNovels } from "@/modules/novels/novels.service";

interface PendingQueueItem {
  target_type: "comment" | "review";
  target_id: string;
  content: string;
}

/** Reference implementation — GET /internal/nlp/pending-queue
 *  Python NLP Worker poll endpoint นี้แทนที่จะต่อ Postgres ตรง ๆ (ดู README ของ nlp-worker
 *  เดิมที่บอกว่า "ปรับใช้แบบใดแบบหนึ่ง" — เลือกทางนี้เพราะทำให้ Node.js Gateway ยังเป็น
 *  จุดเดียวที่เขียน Postgres ตาม BuddyBook_System_Architecture.md ส่วนที่ 1) */
export async function getPendingQueue(limit = 20): Promise<{ items: PendingQueueItem[] }> {
  const [comments, reviews] = await Promise.all([
    prisma.comment.findMany({
      where: { sentiment_label: null },
      orderBy: { created_at: "asc" },
      take: limit,
      select: { comment_id: true, content: true },
    }),
    prisma.review.findMany({
      where: { sentiment_label: null, comment_text: { not: null } },
      orderBy: { created_at: "asc" },
      take: limit,
      select: { review_id: true, comment_text: true },
    }),
  ]);

  const items: PendingQueueItem[] = [
    ...comments.map((c) => ({ target_type: "comment" as const, target_id: c.comment_id, content: c.content })),
    ...reviews.map((r) => ({
      target_type: "review" as const,
      target_id: r.review_id,
      content: r.comment_text as string,
    })),
  ];

  return { items };
}

interface SentimentCallbackInput {
  target_type: "comment" | "review";
  target_id: string;
  sentiment_label: "pos" | "neg" | "neutral";
  /** ความมั่นใจของ label ที่โมเดลทาย (0..1) */
  sentiment_score: number;
  /** ขั้วความรู้สึก −1..1 — worker รุ่นใหม่ส่ง P(pos) − P(neg) มาเอง ถ้าไม่ส่งคำนวณจาก label+score */
  sentiment_polarity?: number;
}

/** Reference implementation — POST /internal/nlp/sentiment-callback
 *  gap 2.1/2.2 — เก็บขั้วความรู้สึก (−1..1) แยกจากความมั่นใจ แล้วคำนวณ READ{sentiment_score} ของ
 *  user→นิยายใหม่จากรีวิว+คอมเมนต์ทั้งหมดของเรื่องนั้น (เดิม sync เฉพาะรีวิว และใช้ความมั่นใจเป็นขั้ว) */
export async function submitSentimentCallback(input: SentimentCallbackInput) {
  const sentiment_polarity = input.sentiment_polarity ?? toPolarity(input.sentiment_label, input.sentiment_score);
  const data = { sentiment_label: input.sentiment_label, sentiment_score: input.sentiment_score, sentiment_polarity };

  let target_id: string;
  let user_id: string;
  let novel_id: string;
  if (input.target_type === "comment") {
    const updated = await prisma.comment.update({
      where: { comment_id: input.target_id },
      data,
      select: { comment_id: true, user_id: true, chapter: { select: { novel_id: true } } },
    });
    target_id = updated.comment_id;
    user_id = updated.user_id;
    novel_id = updated.chapter.novel_id;
  } else {
    const updated = await prisma.review.update({
      where: { review_id: input.target_id },
      data,
      select: { review_id: true, user_id: true, novel_id: true },
    });
    target_id = updated.review_id;
    user_id = updated.user_id;
    novel_id = updated.novel_id;
  }

  refreshReadEdgeSentiment(user_id, novel_id).catch((err) => console.error("Neo4j refreshReadEdgeSentiment failed:", err));

  return { target_id, ...data };
}

/** Reference implementation — POST /internal/trash-bin/purge (Cron รายวัน) */
export async function purgeExpiredTrash() {
  const result = await prisma.trashBin.deleteMany({
    where: { auto_delete_at: { lte: new Date() }, restored_at: null },
  });
  // gap 2.4 — นิยายทั้งเรื่องที่อยู่ในถังขยะครบ 30 วัน
  const { purged_novels } = await purgeExpiredNovels();
  return { purged_count: result.count, purged_novels };
}

/** เพิ่มภายหลัง (Phase B) — POST /internal/chapters/publish-scheduled (Cron ทุก ๆ กี่นาทีก็ได้)
 *  รูปแบบเดียวกับ purgeExpiredTrash เป๊ะ ๆ: batch flip สถานะที่ถึงเวลาแล้ว + คืนจำนวนที่ทำ */
export async function publishScheduledChapters() {
  const due = await prisma.chapter.findMany({
    where: { status: "scheduled", scheduled_publish_at: { lte: new Date() } },
    select: { chapter_id: true, chapter_number: true, title: true, novel_id: true, novel: { select: { author_id: true } } },
  });

  if (due.length === 0) return { published_count: 0 };

  await prisma.chapter.updateMany({
    where: { chapter_id: { in: due.map((c) => c.chapter_id) } },
    data: { status: "published", published_at: new Date(), scheduled_publish_at: null },
  });

  await Promise.all(
    due.map((c) => notifyLibraryOfNewChapter(c.novel_id, c.novel.author_id, c))
  );

  return { published_count: due.length };
}
