import { prisma } from "@/lib/prisma";
import { blendReviewPolarity, refreshReadEdgeSentiment, toPolarity } from "@/lib/sentiment";
import { notifyLibraryOfNewChapter } from "@/lib/chapterNotifications";
import { purgeExpiredNovels } from "@/modules/novels/novels.service";

interface PendingQueueItem {
  target_type: "comment" | "review";
  target_id: string;
  content: string;
  /** เพิ่มภายหลัง — ชื่อตัวละครของนิยายเรื่องนั้น ให้ worker แยกว่าความรู้สึกพุ่งไปที่ตัวละครหรือตัวงาน
   *  ("น็อกซ์น่าสงสาร" = อินกับเรื่อง ไม่ใช่ติงาน — ดู apps/nlp-worker/src/target.py) */
  character_names: string[];
}

const characterNamesSelect = { character_nodes: { select: { character_name: true } } } as const;

/** Reference implementation — GET /internal/nlp/pending-queue
 *  Python NLP Worker poll endpoint นี้แทนที่จะต่อ Postgres ตรง ๆ (ดู README ของ nlp-worker
 *  เดิมที่บอกว่า "ปรับใช้แบบใดแบบหนึ่ง" — เลือกทางนี้เพราะทำให้ Node.js Gateway ยังเป็น
 *  จุดเดียวที่เขียน Postgres ตาม BuddyBook_System_Architecture.md ส่วนที่ 1) */
export async function getPendingQueue(limit = 20): Promise<{ items: PendingQueueItem[] }> {
  const [comments, reviews] = await Promise.all([
    prisma.comment.findMany({
      // คอมเมนต์สติกเกอร์อย่างเดียว (content ว่าง) ไม่มีข้อความให้ NLP วิเคราะห์
      where: { sentiment_label: null, content: { not: "" } },
      orderBy: { created_at: "asc" },
      take: limit,
      select: { comment_id: true, content: true, chapter: { select: { novel: { select: characterNamesSelect } } } },
    }),
    prisma.review.findMany({
      where: { sentiment_label: null, comment_text: { not: null } },
      orderBy: { created_at: "asc" },
      take: limit,
      select: { review_id: true, comment_text: true, novel: { select: characterNamesSelect } },
    }),
  ]);

  const items: PendingQueueItem[] = [
    ...comments.map((c) => ({
      target_type: "comment" as const,
      target_id: c.comment_id,
      content: c.content,
      character_names: c.chapter.novel.character_nodes.map((n) => n.character_name),
    })),
    ...reviews.map((r) => ({
      target_type: "review" as const,
      target_id: r.review_id,
      content: r.comment_text as string,
      character_names: r.novel.character_nodes.map((n) => n.character_name),
    })),
  ];

  return { items };
}

type SentimentTargetTag = "character" | "immersion" | "work";

interface SentimentCallbackInput {
  target_type: "comment" | "review";
  target_id: string;
  sentiment_label: "pos" | "neg" | "neutral";
  /** ความมั่นใจของ label ที่โมเดลทาย (0..1) */
  sentiment_score: number;
  /** ขั้วความรู้สึก −1..1 — worker รุ่นใหม่ส่ง P(pos) − P(neg) มาเอง ถ้าไม่ส่งคำนวณจาก label+score */
  sentiment_polarity?: number;
  /** ความรู้สึกพุ่งไปที่อะไร (target.py, ได้หลายป้าย) — ไม่กระทบ label/polarity และระบบแนะนำ */
  sentiment_targets?: SentimentTargetTag[];
  /** worker รุ่นเก่าส่งป้ายเดียว — แปลงเป็น array ให้ */
  sentiment_target?: SentimentTargetTag | null;
}

/** Reference implementation — POST /internal/nlp/sentiment-callback
 *  gap 2.1/2.2 — เก็บขั้วความรู้สึก (−1..1) แยกจากความมั่นใจ แล้วคำนวณ READ{sentiment_score} ของ
 *  user→นิยายใหม่จากรีวิว+คอมเมนต์ทั้งหมดของเรื่องนั้น (เดิม sync เฉพาะรีวิว และใช้ความมั่นใจเป็นขั้ว) */
export async function submitSentimentCallback(input: SentimentCallbackInput) {
  const sentiment_polarity = input.sentiment_polarity ?? toPolarity(input.sentiment_label, input.sentiment_score);
  const data = {
    sentiment_label: input.sentiment_label,
    sentiment_score: input.sentiment_score,
    sentiment_polarity,
    sentiment_targets: [...new Set(input.sentiment_targets ?? (input.sentiment_target ? [input.sentiment_target] : []))],
  };

  let blended_polarity: number | undefined;
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
    // รีวิว: เก็บค่าดิบไว้ แล้วผสมดาวเป็น blended_polarity (ค่าที่ระบบแนะนำใช้)
    const { rating } = await prisma.review.findUniqueOrThrow({ where: { review_id: input.target_id }, select: { rating: true } });
    blended_polarity = blendReviewPolarity(sentiment_polarity, rating);
    const updated = await prisma.review.update({
      where: { review_id: input.target_id },
      data: { ...data, blended_polarity },
      select: { review_id: true, user_id: true, novel_id: true },
    });
    target_id = updated.review_id;
    user_id = updated.user_id;
    novel_id = updated.novel_id;
  }

  refreshReadEdgeSentiment(user_id, novel_id).catch((err) => console.error("Neo4j refreshReadEdgeSentiment failed:", err));

  return { target_id, ...data, ...(blended_polarity !== undefined ? { blended_polarity } : {}) };
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
    select: {
      chapter_id: true,
      chapter_number: true,
      title: true,
      novel_id: true,
      novel: { select: { author_id: true, title: true } },
    },
  });

  if (due.length === 0) return { published_count: 0 };

  await prisma.chapter.updateMany({
    where: { chapter_id: { in: due.map((c) => c.chapter_id) } },
    data: { status: "published", published_at: new Date(), scheduled_publish_at: null },
  });

  await Promise.all(
    due.map((c) => notifyLibraryOfNewChapter(c.novel_id, c.novel.author_id, c))
  );

  // เพิ่มภายหลัง — แจ้งนักเขียนด้วยว่าตอนที่ตั้งเวลาไว้เผยแพร่แล้ว (เดิมเผยแพร่เงียบ ๆ นักเขียนไม่รู้เลย
  // เพราะ notifyLibraryOfNewChapter ตั้งใจไม่แจ้งเตือนตัวผู้เขียนเอง)
  await prisma.notification.createMany({
    data: due.map((c) => ({
      user_id: c.novel.author_id,
      type: "system" as const,
      content: `ตอนที่ ${c.chapter_number} ${c.title} ของ "${c.novel.title}" เผยแพร่ตามเวลาที่ตั้งไว้แล้ว`,
      link_url: `/novels/${c.novel_id}/chapters/${c.chapter_id}`,
    })),
  });

  return { published_count: due.length };
}
