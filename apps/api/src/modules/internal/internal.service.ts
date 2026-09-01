import { prisma } from "@/lib/prisma";
import { syncReadEdge } from "@/lib/graphSync";
import { notifyLibraryOfNewChapter } from "@/lib/chapterNotifications";

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
  sentiment_score: number;
}

/** Reference implementation — POST /internal/nlp/sentiment-callback
 *  รีวิว (novel-scoped) sync READ{sentiment_score} เข้า Neo4j ทันทีที่รู้ค่าจริง — ปิด loop ของ
 *  Phase 6 recommendation system (คอมเมนต์เป็น chapter-scoped ไม่ได้ map เข้า READ edge ตาม
 *  schema ที่ recommendation_graph_import.cql กำหนดไว้ — sync เฉพาะรีวิวเท่านั้น) */
export async function submitSentimentCallback(input: SentimentCallbackInput) {
  if (input.target_type === "comment") {
    const updated = await prisma.comment.update({
      where: { comment_id: input.target_id },
      data: { sentiment_label: input.sentiment_label, sentiment_score: input.sentiment_score },
      select: { comment_id: true, sentiment_label: true, sentiment_score: true },
    });
    return {
      target_id: updated.comment_id,
      sentiment_label: updated.sentiment_label,
      sentiment_score: updated.sentiment_score,
    };
  }

  const updated = await prisma.review.update({
    where: { review_id: input.target_id },
    data: { sentiment_label: input.sentiment_label, sentiment_score: input.sentiment_score },
    select: { review_id: true, sentiment_label: true, sentiment_score: true, user_id: true, novel_id: true },
  });

  syncReadEdge(updated.user_id, updated.novel_id, updated.sentiment_score).catch((err) =>
    console.error("Neo4j syncReadEdge failed:", err)
  );

  return {
    target_id: updated.review_id,
    sentiment_label: updated.sentiment_label,
    sentiment_score: updated.sentiment_score,
  };
}

/** Reference implementation — POST /internal/trash-bin/purge (Cron รายวัน) */
export async function purgeExpiredTrash() {
  const result = await prisma.trashBin.deleteMany({
    where: { auto_delete_at: { lte: new Date() }, restored_at: null },
  });
  return { purged_count: result.count };
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
