import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { setUserSuspendedCache } from "@/lib/suspension";
import { ApiError } from "@/utils/ApiError";
import { startOfThaiMonth } from "@/modules/gifts/gifts.service";
import { env } from "@/config/env";
import type { TagCategory, UserRole } from "@prisma/client";
import { getQueueCounts } from "@/modules/admin/moderation.service";

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
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    total_users,
    total_novels,
    total_chapters,
    moderation,
    feeAll,
    feeMonth,
    open_content_reports,
    open_gift_reports,
    pending_withdrawals,
    open_support_tickets,
    new_users_7d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.novel.count(),
    prisma.chapter.count(),
    // post-moderation — แทน pending_review_count เดิม: อุทธรณ์ที่รอพิจารณา = งานที่ต้องตัดสิน
    getQueueCounts(),
    // เพิ่มภายหลัง (Gift donations) — ค่าธรรมเนียมแพลตฟอร์มสะสม (SUM donations.fee_amount) ยังไม่เข้าบัญชีใคร
    // เป็นแค่ตัวเลขบันทึกไว้ (ดู modules/gifts/gift-fee.ts)
    prisma.donation.aggregate({ _sum: { fee_amount: true } }),
    prisma.donation.aggregate({ where: { created_at: { gte: startOfThaiMonth() } }, _sum: { fee_amount: true } }),
    // เพิ่มภายหลัง — "งานที่รอแอดมิน" บนหน้าภาพรวม + ตัวเลขบนเมนูหลังบ้าน
    prisma.contentReport.count({ where: { status: "open" } }),
    prisma.donation.count({ where: { reported_at: { not: null }, report_resolved_at: null } }),
    prisma.withdrawalRequest.count({ where: { status: "pending" } }),
    prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress"] } } }),
    prisma.user.count({ where: { created_at: { gte: weekAgo } } }),
  ]);
  return {
    total_users,
    total_novels,
    total_chapters,
    pending_appeal_count: moderation.appeals,
    unreviewed_novel_count: moderation.unreviewed,
    suspended_novel_count: moderation.suspended,
    platform_fee_total: feeAll._sum.fee_amount?.toNumber() ?? 0,
    platform_fee_this_month: feeMonth._sum.fee_amount?.toNumber() ?? 0,
    platform_fee_percent: env.GIFT_PLATFORM_FEE_PERCENT,
    open_content_reports,
    open_gift_reports,
    pending_withdrawals,
    open_support_tickets,
    new_users_7d,
  };
}

/** GET /admin/reports/activity — กิจกรรมเงินล่าสุด (เติมเหรียญที่จ่ายแล้ว + ของขวัญ/โดเนท) สำหรับ hero หน้าภาพรวม
 *  แอดมินเห็นผู้ส่งจริงเสมอ (เหมือน /admin/gift-reports) แม้ผู้ส่งเลือกไม่ระบุตัวตน */
export async function getRecentActivity(limit = 5) {
  const userSelect = { user_id: true, username: true, pen_name: true } as const;
  const [topups, donations] = await Promise.all([
    prisma.topupOrder.findMany({
      where: { status: "paid" },
      orderBy: { paid_at: "desc" },
      take: limit,
      select: { order_id: true, coins: true, amount_thb: true, paid_at: true, created_at: true, user: { select: userSelect } },
    }),
    prisma.donation.findMany({
      orderBy: { created_at: "desc" },
      take: limit,
      select: {
        donation_id: true,
        amount: true,
        quantity: true,
        created_at: true,
        gift: { select: { name_th: true } },
        from_user: { select: userSelect },
        to_user: { select: userSelect },
      },
    }),
  ]);

  const items = [
    ...topups.map((t) => ({
      id: t.order_id,
      kind: "topup" as const,
      coins: t.coins,
      amount_thb: t.amount_thb.toNumber(),
      user: t.user,
      recipient: null,
      gift_name: null,
      quantity: 1,
      created_at: t.paid_at ?? t.created_at,
    })),
    ...donations.map((d) => ({
      id: d.donation_id,
      kind: "gift" as const,
      coins: d.amount.toNumber(),
      amount_thb: null,
      user: d.from_user,
      recipient: d.to_user,
      gift_name: d.gift?.name_th ?? null,
      quantity: d.quantity,
      created_at: d.created_at,
    })),
  ];
  items.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  return { items: items.slice(0, limit) };
}

// ---------------------------------------------------------------------------
// GET /admin/reports/sentiment — ภาพรวมความรู้สึกผู้อ่านทั้งแพลตฟอร์ม (หลังบ้านเท่านั้น)
// หน้านักเขียนแสดงแค่ฝั่งบวก (ดู stats.service.ts) ตัวเลขเชิงลบ/เป็นกลาง ค่าเฉลี่ยความรู้สึก และป้าย "งานเขียน"
// ดูได้ที่นี่ที่เดียว — ไม่นับคอมเมนต์/รีวิวของนักเขียนบนนิยายตัวเอง (เช่นตอบกลับผู้อ่าน)
// ---------------------------------------------------------------------------
const SENTIMENT_WEEKS = 8;

/** ข้อความของผู้อ่าน (คอมเมนต์ + รีวิวที่มีข้อความ) ทั้งหมด — ใช้ซ้ำในทุก query ด้านล่าง */
const readerFeedback = Prisma.sql`
  SELECT n.novel_id, c.sentiment_label::text AS label, c.sentiment_targets::text[] AS targets,
         c.sentiment_polarity AS polarity, c.created_at
    FROM comments c
    JOIN chapters ch ON ch.chapter_id = c.chapter_id
    JOIN novels n ON n.novel_id = ch.novel_id
   WHERE c.user_id <> n.author_id AND c.content <> ''
  UNION ALL
  SELECT n.novel_id, r.sentiment_label::text, r.sentiment_targets::text[], coalesce(r.blended_polarity, r.sentiment_polarity), r.created_at
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
  const [groups, targetGroups, byRating, weeks, novels] = await Promise.all([
    prisma.$queryRaw<{ label: string | null; n: number; polarity_sum: number | null }[]>`
      SELECT label, count(*)::int AS n, sum(polarity)::float AS polarity_sum
        FROM (${readerFeedback}) f
       GROUP BY label`,
    // ข้อความหนึ่งมีได้หลายป้าย — นับแยกทุกป้าย (ผลรวมแถวนี้จึงมากกว่าจำนวนข้อความได้) ไม่มีป้าย = none
    prisma.$queryRaw<{ label: string; target: string; n: number }[]>`
      SELECT f.label, coalesce(t.tag, 'none') AS target, count(*)::int AS n
        FROM (${readerFeedback}) f
        LEFT JOIN LATERAL unnest(f.targets) AS t(tag) ON true
       WHERE f.label IS NOT NULL
       GROUP BY f.label, coalesce(t.tag, 'none')`,
    // รีวิวแยกตามดาว: ค่าดิบจากโมเดล เทียบกับค่าหลังผสมดาว (ตารางสำหรับรายงาน)
    prisma.$queryRaw<{ rating: number | null; n: number; pos: number; neutral: number; neg: number; raw: number | null; blended: number | null }[]>`
      SELECT r.rating::int AS rating, count(*)::int AS n,
             count(*) FILTER (WHERE r.sentiment_label = 'pos')::int AS pos,
             count(*) FILTER (WHERE r.sentiment_label = 'neutral')::int AS neutral,
             count(*) FILTER (WHERE r.sentiment_label = 'neg')::int AS neg,
             avg(r.sentiment_polarity)::float AS raw, avg(r.blended_polarity)::float AS blended
        FROM reviews r
        JOIN novels n ON n.novel_id = r.novel_id
       WHERE r.user_id <> n.author_id AND r.sentiment_polarity IS NOT NULL
       GROUP BY r.rating ORDER BY r.rating DESC NULLS LAST`,
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
             count(*) FILTER (WHERE f.label = 'neg' AND 'work' = ANY(f.targets))::int AS work_neg,
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
  }
  for (const g of targetGroups) {
    targets[g.target] ??= { pos: 0, neutral: 0, neg: 0 };
    targets[g.target][g.label as "pos" | "neutral" | "neg"] += Number(g.n);
  }

  return {
    counts,
    avg_polarity: analysed ? round2(polaritySum / analysed) : null,
    /** ป้ายเป้าหมาย × ความรู้สึก — character / immersion / work / none (ยังไม่มีป้าย หรือระบุไม่ได้)
     *  ข้อความที่มีหลายป้ายนับในทุกป้ายของมัน */
    targets,
    /** รีวิวแยกตามดาว — raw = ค่าเฉลี่ยขั้วจากข้อความอย่างเดียว, blended = หลังผสมดาว (ค่าที่ระบบแนะนำใช้) */
    reviews_by_rating: byRating.map((r) => ({
      rating: r.rating === null ? null : Number(r.rating),
      count: Number(r.n),
      pos: Number(r.pos),
      neutral: Number(r.neutral),
      neg: Number(r.neg),
      avg_raw_polarity: round2(r.raw),
      avg_blended_polarity: round2(r.blended),
    })),
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
