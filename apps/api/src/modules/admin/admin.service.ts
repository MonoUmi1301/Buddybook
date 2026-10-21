import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { setUserSuspendedCache } from "@/lib/suspension";
import { ApiError } from "@/utils/ApiError";
import { startOfThaiMonth } from "@/modules/gifts/gifts.service";
import { env } from "@/config/env";
import type { TagCategory, UserRole } from "@prisma/client";

/** Reference implementation — GET /admin/novels/pending */
export async function listPendingNovels() {
  const novels = await prisma.novel.findMany({
    where: { visibility: "pending_review" },
    orderBy: { created_at: "asc" },
    select: {
      novel_id: true,
      title: true,
      legal_status: true,
      cover_image_url: true,
      author: { select: { user_id: true, username: true } },
    },
  });
  return { novels };
}

/** Reference implementation — PATCH /admin/novels/:novel_id/approve */
export async function approveNovel(novel_id: string) {
  const novel = await prisma.novel.update({
    where: { novel_id },
    data: { visibility: "published" },
    select: { novel_id: true, visibility: true, author_id: true, title: true },
  });

  await prisma.notification.create({
    data: {
      user_id: novel.author_id,
      type: "system",
      content: `นิยาย "${novel.title}" ของคุณผ่านการตรวจสอบและเผยแพร่แล้ว`,
      link_url: `/novels/${novel_id}`,
    },
  });

  return { novel_id: novel.novel_id, visibility: novel.visibility };
}

/** Reference implementation — PATCH /admin/novels/:novel_id/reject */
export async function rejectNovel(novel_id: string, reason: string) {
  const existing = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true, title: true } });
  if (!existing) throw ApiError.notFound("Novel not found");

  const novel = await prisma.novel.update({
    where: { novel_id },
    data: { visibility: "private" },
    select: { novel_id: true, visibility: true },
  });

  await prisma.notification.create({
    data: {
      user_id: existing.author_id,
      type: "system",
      content: `นิยาย "${existing.title}" ของคุณไม่ผ่านการตรวจสอบ: ${reason}`,
      link_url: `/novels/${novel_id}`,
    },
  });

  return { novel_id: novel.novel_id, visibility: novel.visibility, reason };
}

/** Reference implementation — GET /admin/users?page= */
export async function listUsers(page: number, pageSize = 20) {
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        user_id: true,
        username: true,
        email: true,
        role: true,
        is_suspended: true,
        created_at: true,
      },
    }),
    prisma.user.count(),
  ]);
  return { users, total };
}

/** Reference implementation — PATCH /admin/users/:user_id/role */
export async function updateUserRole(user_id: string, role: UserRole) {
  const user = await prisma.user.update({
    where: { user_id },
    data: { role },
    select: { user_id: true, role: true },
  });
  return user;
}

/** Reference implementation — PATCH /admin/users/:user_id/suspend
 *  เพิ่มภายหลัง (auth hardening) — มีผลทันทีกับทุก request ผ่าน cache ใน lib/suspension.ts
 *  (เดิมบล็อกแค่ตอน login/refresh ทำให้ access token ที่ออกไปแล้วใช้ต่อได้อีกถึง 15 นาที) */
export async function suspendUser(user_id: string) {
  return setSuspended(user_id, true);
}

/** เพิ่มภายหลัง — PATCH /admin/users/:user_id/unsuspend (เดิมระงับแล้วยกเลิกไม่ได้จากหน้าแอดมิน) */
export async function unsuspendUser(user_id: string) {
  return setSuspended(user_id, false);
}

async function setSuspended(user_id: string, is_suspended: boolean) {
  const user = await prisma.user.update({
    where: { user_id },
    data: { is_suspended },
    select: { user_id: true, is_suspended: true },
  });
  setUserSuspendedCache(user.user_id, user.is_suspended);
  return { user_id: user.user_id, suspended: user.is_suspended };
}

/** Reference implementation — GET /admin/tags (Public) */
export async function listTags() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return { tags };
}

/** Reference implementation — POST /admin/tags */
export async function createTag(name: string, category?: TagCategory) {
  try {
    const tag = await prisma.tag.create({
      data: { name, category },
      select: { tag_id: true, name: true, category: true },
    });
    return tag;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("Tag name already exists");
    }
    throw err;
  }
}

interface UpdateTagInput {
  name?: string;
  category?: TagCategory;
}

/** Reference implementation — PATCH /admin/tags/:tag_id */
export async function updateTag(tag_id: number, input: UpdateTagInput) {
  try {
    const tag = await prisma.tag.update({
      where: { tag_id },
      data: input,
      select: { tag_id: true, name: true, category: true },
    });
    return tag;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("Tag name already exists");
    }
    throw err;
  }
}

/** Reference implementation — DELETE /admin/tags/:tag_id (cascade ลบ novel_tags/user_interests
 *  ที่ผูกกับแท็กนี้ไปด้วย ตาม onDelete: Cascade ใน schema.prisma) */
export async function deleteTag(tag_id: number) {
  await prisma.tag.delete({ where: { tag_id } });
}

/** Reference implementation — GET /admin/reports/stats */
export async function getStats() {
  const [total_users, total_novels, total_chapters, pending_review_count, feeAll, feeMonth] = await Promise.all([
    prisma.user.count(),
    prisma.novel.count(),
    prisma.chapter.count(),
    prisma.novel.count({ where: { visibility: "pending_review" } }),
    // เพิ่มภายหลัง (Gift donations) — ค่าธรรมเนียมแพลตฟอร์มสะสม (SUM donations.fee_amount) ยังไม่เข้าบัญชีใคร
    // เป็นแค่ตัวเลขบันทึกไว้ (ดู modules/gifts/gift-fee.ts)
    prisma.donation.aggregate({ _sum: { fee_amount: true } }),
    prisma.donation.aggregate({ where: { created_at: { gte: startOfThaiMonth() } }, _sum: { fee_amount: true } }),
  ]);
  return {
    total_users,
    total_novels,
    total_chapters,
    pending_review_count,
    platform_fee_total: feeAll._sum.fee_amount?.toNumber() ?? 0,
    platform_fee_this_month: feeMonth._sum.fee_amount?.toNumber() ?? 0,
    platform_fee_percent: env.GIFT_PLATFORM_FEE_PERCENT,
  };
}

// ---------------------------------------------------------------------------
// GET /admin/reports/sentiment — ภาพรวมความรู้สึกผู้อ่านทั้งแพลตฟอร์ม (หลังบ้านเท่านั้น)
// หน้านักเขียนแสดงแค่ฝั่งบวก (ดู stats.service.ts) ตัวเลขเชิงลบ/เป็นกลาง ค่าเฉลี่ยความรู้สึก และป้าย "งานเขียน"
// ดูได้ที่นี่ที่เดียว — ไม่นับคอมเมนต์/รีวิวของนักเขียนบนนิยายตัวเอง (เช่นตอบกลับผู้อ่าน)
// ---------------------------------------------------------------------------
const SENTIMENT_WEEKS = 8;

/** ข้อความของผู้อ่าน (คอมเมนต์ + รีวิวที่มีข้อความ) ทั้งหมด — ใช้ซ้ำในทุก query ด้านล่าง */
const readerFeedback = Prisma.sql`
  SELECT n.novel_id, c.sentiment_label::text AS label, c.sentiment_target::text AS target,
         c.sentiment_polarity AS polarity, c.created_at
    FROM comments c
    JOIN chapters ch ON ch.chapter_id = c.chapter_id
    JOIN novels n ON n.novel_id = ch.novel_id
   WHERE c.user_id <> n.author_id AND c.content <> ''
  UNION ALL
  SELECT n.novel_id, r.sentiment_label::text, r.sentiment_target::text, r.sentiment_polarity, r.created_at
    FROM reviews r
    JOIN novels n ON n.novel_id = r.novel_id
   WHERE r.user_id <> n.author_id AND coalesce(r.comment_text, '') <> ''`;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const round2 = (v: unknown): number | null => {
  const n = num(v);
  return n === null || Number.isNaN(n) ? null : Math.round(n * 100) / 100;
};

export async function getSentimentOverview() {
  const since = new Date(Date.now() - SENTIMENT_WEEKS * 7 * 24 * 60 * 60 * 1000);
  const [groups, weeks, novels] = await Promise.all([
    prisma.$queryRaw<{ label: string | null; target: string | null; n: number; polarity_sum: number | null }[]>`
      SELECT label, target, count(*)::int AS n, sum(polarity)::float AS polarity_sum
        FROM (${readerFeedback}) f
       GROUP BY label, target`,
    prisma.$queryRaw<{ week_start: Date; n: number; neg: number; avg_polarity: number | null }[]>`
      SELECT date_trunc('week', created_at AT TIME ZONE 'Asia/Bangkok')::date AS week_start,
             count(*)::int AS n, count(*) FILTER (WHERE label = 'neg')::int AS neg, avg(polarity)::float AS avg_polarity
        FROM (${readerFeedback}) f
       WHERE created_at >= ${since} AND label IS NOT NULL
       GROUP BY 1 ORDER BY 1`,
    // นิยายที่ผู้อ่านไม่ค่อยพอใจ — อย่างน้อย 5 ข้อความที่วิเคราะห์แล้ว เรียงจากสัดส่วนเชิงลบมากสุด
    prisma.$queryRaw<
      { novel_id: string; title: string; author: string; analysed: number; neg: number; work_neg: number; avg_polarity: number | null }[]
    >`
      SELECT f.novel_id, n.title, coalesce(u.pen_name, u.username) AS author,
             count(*)::int AS analysed,
             count(*) FILTER (WHERE f.label = 'neg')::int AS neg,
             count(*) FILTER (WHERE f.label = 'neg' AND f.target = 'work')::int AS work_neg,
             avg(f.polarity)::float AS avg_polarity
        FROM (${readerFeedback}) f
        JOIN novels n ON n.novel_id = f.novel_id
        JOIN users u ON u.user_id = n.author_id
       WHERE f.label IS NOT NULL AND n.deleted_at IS NULL
       GROUP BY f.novel_id, n.title, u.pen_name, u.username
      HAVING count(*) >= 5
       ORDER BY count(*) FILTER (WHERE f.label = 'neg')::float / count(*) DESC, count(*) DESC
       LIMIT 10`,
  ]);

  const counts = { pos: 0, neutral: 0, neg: 0, pending: 0 };
  const targets: Record<string, { pos: number; neutral: number; neg: number }> = {};
  let polaritySum = 0;
  let analysed = 0;
  for (const g of groups) {
    const n = Number(g.n);
    if (!g.label) {
      counts.pending += n;
      continue;
    }
    const label = g.label as "pos" | "neutral" | "neg";
    counts[label] += n;
    analysed += n;
    polaritySum += Number(g.polarity_sum ?? 0);
    const key = g.target ?? "none";
    targets[key] ??= { pos: 0, neutral: 0, neg: 0 };
    targets[key][label] += n;
  }

  return {
    counts,
    avg_polarity: analysed ? round2(polaritySum / analysed) : null,
    /** ป้ายเป้าหมาย × ความรู้สึก — character / immersion / work / none (ยังไม่มีป้าย หรือระบุไม่ได้) */
    targets,
    weekly: weeks.map((w) => ({
      week_start: w.week_start.toISOString().slice(0, 10),
      count: Number(w.n),
      neg: Number(w.neg),
      avg_polarity: round2(w.avg_polarity),
    })),
    novels_needing_attention: novels.map((n) => ({
      novel_id: n.novel_id,
      title: n.title,
      author: n.author,
      analysed: Number(n.analysed),
      neg: Number(n.neg),
      neg_share: round2(Number(n.neg) / Number(n.analysed)),
      work_neg: Number(n.work_neg),
      avg_polarity: round2(n.avg_polarity),
    })),
  };
}
