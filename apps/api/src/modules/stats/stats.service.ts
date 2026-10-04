import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { thaiDay } from "@/lib/viewTracking";
import { topKeywords } from "@/lib/keywords";

/**
 * gap 3.1 + 3.5 — หน้าสถิตินักเขียน (Userflow: "หน้าสถิติ → แสดงสถิตินิยายของฉัน")
 * รวม social listening ภายในแพลตฟอร์ม: สัดส่วน/แนวโน้มความรู้สึกของผู้อ่าน + คำที่พูดถึงบ่อย
 * ทุกตัวเลขนับเฉพาะผู้อ่าน (ไม่นับคอมเมนต์/รีวิวของนักเขียนเอง)
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const SENTIMENT_WEEKS = 8;

function round(n: number | null | undefined, digits = 2): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** วันในช่วง (เวลาไทย) เก่า → ใหม่ — ใช้เติม 0 ให้วันที่ไม่มีคนอ่าน กราฟจะได้ไม่ข้ามวัน */
export function dayRange(days: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(thaiDay(new Date(now.getTime() - i * DAY_MS)));
  return out;
}

/** GET /me/stats/novels — ภาพรวมทุกเรื่องของฉัน */
export async function getMyNovelsOverview(user_id: string) {
  const novels = await prisma.novel.findMany({
    where: { author_id: user_id, deleted_at: null },
    orderBy: { created_at: "desc" },
    select: {
      novel_id: true,
      title: true,
      cover_image_url: true,
      visibility: true,
      view_count: true,
      _count: { select: { novel_likes: true, reading_progress: true, reviews: true, chapters: true } },
    },
  });
  const ids = novels.map((n) => n.novel_id);
  if (ids.length === 0) return { novels: [] };

  const since = thaiDay(new Date(Date.now() - 6 * DAY_MS));
  const [views7d, ratings, polarity] = await Promise.all([
    prisma.chapterViewDaily.groupBy({
      by: ["novel_id"],
      where: { novel_id: { in: ids }, day: { gte: new Date(since) } },
      _sum: { views: true },
    }),
    prisma.review.groupBy({ by: ["novel_id"], where: { novel_id: { in: ids } }, _avg: { rating: true } }),
    prisma.review.groupBy({
      by: ["novel_id"],
      where: { novel_id: { in: ids }, sentiment_polarity: { not: null } },
      _avg: { sentiment_polarity: true },
    }),
  ]);
  const v7 = new Map(views7d.map((v) => [v.novel_id, v._sum.views ?? 0]));
  const rating = new Map(ratings.map((r) => [r.novel_id, r._avg.rating]));
  const pol = new Map(polarity.map((p) => [p.novel_id, p._avg.sentiment_polarity]));

  return {
    novels: novels.map((n) => ({
      novel_id: n.novel_id,
      title: n.title,
      cover_image_url: n.cover_image_url,
      visibility: n.visibility,
      views: Number(n.view_count),
      views_7d: v7.get(n.novel_id) ?? 0,
      readers: n._count.reading_progress,
      likes: n._count.novel_likes,
      reviews: n._count.reviews,
      chapters: n._count.chapters,
      avg_rating: round(rating.get(n.novel_id), 1),
      avg_polarity: round(pol.get(n.novel_id)),
    })),
  };
}

/** GET /me/stats/novels/:novel_id?days=30 — รายละเอียดหนึ่งเรื่อง */
export async function getNovelStats(novel_id: string, user_id: string, days: number, now = new Date()) {
  const novel = await prisma.novel.findUnique({
    where: { novel_id },
    select: { novel_id: true, title: true, author_id: true, view_count: true, created_at: true, deleted_at: true },
  });
  if (!novel || novel.deleted_at) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const range = dayRange(days, now);
  const sentimentSince = new Date(now.getTime() - SENTIMENT_WEEKS * 7 * DAY_MS);
  const readerFilter = { not: user_id };

  const [
    chapters,
    viewRows,
    chapterViewTotals,
    progress,
    likes,
    libraryAdds,
    reviewAgg,
    comments,
    reviews,
    purchases,
    gifts,
  ] = await Promise.all([
    prisma.chapter.findMany({
      where: { novel_id },
      orderBy: { chapter_number: "asc" },
      select: {
        chapter_id: true,
        chapter_number: true,
        title: true,
        status: true,
        _count: { select: { comments: { where: { user_id: readerFilter } }, purchases: true } },
      },
    }),
    prisma.chapterViewDaily.groupBy({
      by: ["day"],
      where: { novel_id, day: { gte: new Date(range[0]) } },
      _sum: { views: true },
    }),
    prisma.chapterViewDaily.groupBy({ by: ["chapter_id"], where: { novel_id }, _sum: { views: true } }),
    prisma.readingProgress.findMany({ where: { novel_id, user_id: readerFilter }, select: { last_chapter_number: true } }),
    prisma.novelLike.count({ where: { novel_id } }),
    prisma.userLibrary.count({ where: { novel_id } }),
    prisma.review.aggregate({ where: { novel_id, user_id: readerFilter }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.comment.findMany({
      where: { user_id: readerFilter, chapter: { novel_id } },
      select: { content: true, sentiment_label: true, sentiment_polarity: true, created_at: true },
    }),
    prisma.review.findMany({
      where: { novel_id, user_id: readerFilter },
      select: { comment_text: true, sentiment_label: true, sentiment_polarity: true, created_at: true },
    }),
    prisma.chapterPurchase.aggregate({
      where: { chapter: { novel_id } },
      _sum: { price_coins: true, fee_coins: true },
      _count: { _all: true },
    }),
    prisma.donation.aggregate({ where: { novel_id }, _sum: { net_amount: true } }),
  ]);

  // ---- ยอดวิวรายวัน ----
  const byDay = new Map(viewRows.map((r) => [thaiDayFromDate(r.day), r._sum.views ?? 0]));
  const daily_views = range.map((day) => ({ day, views: byDay.get(day) ?? 0 }));

  // ---- รายตอน: ยอดวิว, คอมเมนต์, ผู้อ่านที่ไปถึงตอนนี้ (retention) ----
  const viewsByChapter = new Map(chapterViewTotals.map((r) => [r.chapter_id, r._sum.views ?? 0]));
  const reached = (n: number) => progress.filter((p) => p.last_chapter_number >= n).length;
  const chapterRows = chapters.map((c) => ({
    chapter_id: c.chapter_id,
    chapter_number: c.chapter_number,
    title: c.title,
    status: c.status,
    views: viewsByChapter.get(c.chapter_id) ?? 0,
    comments: c._count.comments,
    purchases: c._count.purchases,
    readers_reached: reached(c.chapter_number),
  }));

  // ---- ความรู้สึกผู้อ่าน (social listening) ----
  const feedback = [
    ...comments.map((c) => ({ text: c.content, label: c.sentiment_label, polarity: c.sentiment_polarity, at: c.created_at })),
    ...reviews
      .filter((r) => r.comment_text)
      .map((r) => ({ text: r.comment_text as string, label: r.sentiment_label, polarity: r.sentiment_polarity, at: r.created_at })),
  ];
  const counts = { pos: 0, neg: 0, neutral: 0, pending: 0 };
  for (const f of feedback) counts[f.label ?? "pending"] += 1;
  const analysed = feedback.filter((f) => f.polarity !== null);
  const avg_polarity = analysed.length
    ? analysed.reduce((a, f) => a + (f.polarity as number), 0) / analysed.length
    : null;

  const weekly = [];
  for (let w = SENTIMENT_WEEKS - 1; w >= 0; w--) {
    const end = new Date(now.getTime() - w * 7 * DAY_MS);
    const start = new Date(end.getTime() - 7 * DAY_MS);
    const inWeek = analysed.filter((f) => f.at > start && f.at <= end);
    weekly.push({
      week_start: thaiDay(new Date(start.getTime() + DAY_MS)),
      count: inWeek.length,
      avg_polarity: inWeek.length ? round(inWeek.reduce((a, f) => a + (f.polarity as number), 0) / inWeek.length) : null,
    });
  }

  const recent = feedback.filter((f) => f.at >= sentimentSince);
  const keywords = {
    positive: topKeywords(recent.filter((f) => f.label === "pos").map((f) => f.text)),
    negative: topKeywords(recent.filter((f) => f.label === "neg").map((f) => f.text)),
    all: topKeywords(recent.map((f) => f.text)),
  };

  const salesNet = (purchases._sum.price_coins ?? 0) - (purchases._sum.fee_coins ?? 0);

  return {
    novel: { novel_id: novel.novel_id, title: novel.title, created_at: novel.created_at },
    range_days: days,
    totals: {
      views: Number(novel.view_count),
      views_in_range: daily_views.reduce((a, d) => a + d.views, 0),
      readers: progress.length,
      likes,
      library_adds: libraryAdds,
      reviews: reviewAgg._count._all,
      avg_rating: round(reviewAgg._avg.rating, 1),
      comments: comments.length,
      chapter_sales: purchases._count._all,
      chapter_sales_coins: salesNet,
      gift_coins: Number(gifts._sum.net_amount ?? 0),
    },
    daily_views,
    chapters: chapterRows,
    sentiment: { counts, avg_polarity: round(avg_polarity), weekly },
    keywords,
  };
}

/** คอลัมน์ DATE กลับมาเป็น Date เวลา 00:00 UTC — แปลงเป็น YYYY-MM-DD ตรง ๆ (ห้ามแปลง timezone ซ้ำ) */
function thaiDayFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
