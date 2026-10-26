import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { stringToUuid } from "@/lib/idHash";
import { COIN_PACKAGES } from "@/modules/wallet/wallet.service";
import { getLastFullResyncAt } from "@/modules/recommendations/recommendations.service";
import { onlineReaderCount } from "@/lib/presence";

// ---------------------------------------------------------------------------
// GET /admin/dashboard — ข้อมูลหน้า "ภาพรวม" (bento) ของหลังบ้าน รวมทุกอย่างใน request เดียว
// วัน/ชั่วโมงนับตามเวลาไทย (Asia/Bangkok) ช่องที่ไม่มีข้อมูลเติม 0 ฝั่งนี้ ให้หน้าเว็บวาดกราฟได้ตรง ๆ
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const TZ = "Asia/Bangkok";

/** วันที่แบบ YYYY-MM-DD ตามเวลาไทย */
function thaiDay(d: Date): string {
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** เที่ยงคืนวันนี้ตามเวลาไทย (เป็นเวลา UTC) */
function startOfThaiDay(now = new Date()): Date {
  return new Date(Date.parse(`${thaiDay(now)}T00:00:00+07:00`));
}

/** ลิสต์วันย้อนหลัง n วัน (รวมวันนี้) เติม 0 ให้วันที่ไม่มีข้อมูล */
function fillDays(rows: { day: string; value: number }[], n: number, now = new Date()) {
  const byDay = new Map(rows.map((r) => [r.day, r.value]));
  const today = startOfThaiDay(now).getTime();
  return Array.from({ length: n }, (_, i) => {
    const day = thaiDay(new Date(today - (n - 1 - i) * DAY_MS + 12 * 3600 * 1000));
    return { date: day, value: byDay.get(day) ?? 0 };
  });
}

/** coin ที่เติม → บาท: ทั้งสลิปและ Stripe ใช้แพ็กเกจใน COIN_PACKAGES (coin → ราคาบาทไม่ซ้ำกัน)
 *  ยอดที่ไม่ตรงแพ็กเกจ (ข้อมูลเก่า/seed) คิดตาม COIN_TO_THB_RATE */
const topupThb = Prisma.sql`CASE wt.amount ${Prisma.join(
  Object.values(COIN_PACKAGES).map((p) => Prisma.sql`WHEN ${p.coins} THEN ${p.priceThb}`),
  " "
)} ELSE wt.amount * ${env.COIN_TO_THB_RATE} END`;

type ActivityType = "topup" | "donate" | "gift" | "novel" | "report";
type ActivityStatus = "success" | "pending" | "failed";
interface Activity {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  detail: string;
  amount: number | null;
  at: string;
}

export async function getDashboard() {
  const now = new Date();
  const todayStart = startOfThaiDay(now);
  const since60 = new Date(todayStart.getTime() - 59 * DAY_MS);
  const since365 = new Date(todayStart.getTime() - 364 * DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const dayAgo = new Date(now.getTime() - DAY_MS);

  const [
    revenueRows,
    topupRows,
    donationRows,
    genreRows,
    trendingRows,
    contentReportsOpen,
    giftReportsOpen,
    hourlyRows,
    newUsersToday,
    chaptersToday,
    activity,
    evalRuns,
  ] = await Promise.all([
    prisma.$queryRaw<{ day: string; value: number }[]>`
      SELECT to_char((wt.created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day, sum(${topupThb})::float AS value
        FROM wallet_transactions wt
       WHERE wt.type = 'topup' AND wt.created_at >= ${since60}
       GROUP BY 1`,
    prisma.$queryRaw<{ day: string; value: number }[]>`
      SELECT to_char((created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day, sum(amount)::float AS value
        FROM wallet_transactions
       WHERE type = 'topup' AND created_at >= ${since365}
       GROUP BY 1`,
    // โดเนท = ทั้ง coin เปล่า (gift_id null) และของขวัญ — ยอด gross ที่ผู้อ่านจ่าย
    prisma.$queryRaw<{ day: string; value: number }[]>`
      SELECT to_char((created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day, sum(amount)::float AS value
        FROM donations
       WHERE created_at >= ${since365}
       GROUP BY 1`,
    // หมวดหลักของนิยาย — primary_tag อาจเป็นหมวดรอง ให้นับเข้าหมวดแม่
    prisma.$queryRaw<{ tag_id: number; name: string; n: number }[]>`
      SELECT g.tag_id, g.name, count(*)::int AS n
        FROM novels nv
        JOIN tags t ON t.tag_id = nv.primary_tag_id
        JOIN tags g ON g.tag_id = coalesce(t.parent_tag_id, t.tag_id)
       WHERE nv.deleted_at IS NULL AND nv.visibility = 'published'
       GROUP BY g.tag_id, g.name
       ORDER BY n DESC`,
    prisma.$queryRaw<{ novel_id: string; title: string; cover_image_url: string | null; author: string; weekly_views: number }[]>`
      SELECT nv.novel_id, nv.title, nv.cover_image_url, coalesce(u.pen_name, u.username) AS author,
             sum(v.views)::int AS weekly_views
        FROM chapter_view_daily v
        JOIN novels nv ON nv.novel_id = v.novel_id
        JOIN users u ON u.user_id = nv.author_id
       WHERE v.day >= ${new Date(todayStart.getTime() - 6 * DAY_MS)}::date
         AND nv.deleted_at IS NULL AND nv.visibility = 'published'
       GROUP BY nv.novel_id, nv.title, nv.cover_image_url, u.pen_name, u.username
       ORDER BY weekly_views DESC
       LIMIT 5`,
    prisma.contentReport.findMany({ where: { status: "open" }, select: { created_at: true } }),
    prisma.donation.findMany({
      where: { reported_at: { not: null }, report_resolved_at: null },
      select: { reported_at: true },
    }),
    prisma.$queryRaw<{ hour: Date; n: number }[]>`
      SELECT date_trunc('hour', published_at) AS hour, count(*)::int AS n
        FROM chapters
       WHERE status = 'published' AND published_at >= ${dayAgo} AND published_at <= ${now}
       GROUP BY 1`,
    prisma.user.count({ where: { created_at: { gte: todayStart } } }),
    prisma.chapter.count({ where: { status: "published", published_at: { gte: todayStart, lte: now } } }),
    getRecentActivity(),
    // ผลประเมินจากข้อมูลจริง 10 รอบล่าสุด (npm run eval:recs:live)
    prisma.recommenderEvalRun.findMany({ orderBy: { created_at: "desc" }, take: 10 }),
  ]);
  // ผู้อ่านที่หน้าอ่านตอนส่ง heartbeat มาภายใน ~2 นาที (lib/presence.ts)
  const readersOnline = onlineReaderCount(now);

  // ---- รายงานรอตรวจ: เปิดอยู่ทั้งหมด แยกตามเวลาที่ถูกแจ้ง ----
  const reportTimes = [
    ...contentReportsOpen.map((r) => r.created_at),
    ...giftReportsOpen.map((r) => r.reported_at as Date),
  ];
  const pendingReports = {
    today: reportTimes.filter((t) => t >= todayStart).length,
    week: reportTimes.filter((t) => t >= weekAgo).length,
    all: reportTimes.length,
    content: contentReportsOpen.length,
    gift: giftReportsOpen.length,
  };

  // ---- ตอนใหม่รายชั่วโมง 24 ช่อง (ช่องสุดท้าย = ชั่วโมงปัจจุบัน) ----
  const hourMs = 3600 * 1000;
  const currentHour = Math.floor(now.getTime() / hourMs) * hourMs;
  const byHour = new Map(hourlyRows.map((r) => [new Date(r.hour).getTime(), r.n]));
  const hourlyChapters = Array.from({ length: 24 }, (_, i) => {
    const t = currentHour - (23 - i) * hourMs;
    return { hour: new Date(t).toISOString(), value: byHour.get(t) ?? 0 };
  });

  // ---- สัดส่วนหมวด: 5 อันดับแรก + อื่น ๆ ----
  const topGenres = genreRows.slice(0, 5).map((g) => ({ id: String(g.tag_id), name: g.name, count: g.n }));
  const otherCount = genreRows.slice(5).reduce((s, g) => s + g.n, 0);
  const genreAllocation = otherCount > 0 ? [...topGenres, { id: "other", name: "อื่น ๆ", count: otherCount }] : topGenres;

  const lastResync = getLastFullResyncAt();
  const latestEval = evalRuns[0] ?? null;

  return {
    generatedAt: now.toISOString(),
    revenueDaily: fillDays(revenueRows, 60, now),
    topupSeries: fillDays(topupRows, 365, now),
    donationSeries: fillDays(donationRows, 365, now),
    genreAllocation,
    trendingNovels: trendingRows.map((n) => ({
      id: n.novel_id,
      title: n.title,
      author: n.author,
      coverUrl: n.cover_image_url,
      weeklyReads: n.weekly_views,
    })),
    pendingReports,
    hourlyChapters,
    todayStats: { newUsers: newUsersToday, readersOnline, chaptersToday },
    recentActivity: activity,
    // ยังไม่เคยรันประเมิน → ตัวชี้วัดเป็น null (หน้าเว็บแสดง "—" พร้อมวิธีรัน)
    recommender: {
      threshold: latestEval?.threshold ?? null,
      precision: latestEval?.precision ?? null,
      recall: latestEval?.recall ?? null,
      f1: latestEval?.f1 ?? null,
      ndcg: latestEval?.ndcg ?? null,
      baselineNdcg: latestEval?.baseline_ndcg ?? null,
      k: latestEval?.k ?? 10,
      lowData: latestEval?.low_data ?? false,
      evaluatedAt: latestEval?.created_at.toISOString() ?? null,
      updatedAt: lastResync ? lastResync.toISOString() : null,
      history: evalRuns.map((r) => r.ndcg).reverse(),
    },
  };
}

/** กิจกรรมล่าสุด 5 ประเภท รวมกันแล้วเรียงตามเวลา 12 รายการ */
async function getRecentActivity(): Promise<Activity[]> {
  const take = 8;
  const [orders, slipTopups, donations, novels, reports] = await Promise.all([
    // Stripe — มีสถานะ pending/failed ให้เห็นด้วย
    prisma.topupOrder.findMany({
      orderBy: { created_at: "desc" },
      take,
      select: {
        order_id: true,
        stripe_session_id: true,
        coins: true,
        amount_thb: true,
        status: true,
        created_at: true,
        paid_at: true,
        user: { select: { username: true, pen_name: true } },
      },
    }),
    // การเติมสำเร็จทั้งหมด (สลิปไม่มีแถว order) — แถวของ Stripe ซ้ำกับ orders ด้านบน คัดออกด้วย reference_id
    prisma.walletTransaction.findMany({
      where: { type: "topup" },
      orderBy: { created_at: "desc" },
      take,
      select: { transaction_id: true, amount: true, reference_id: true, created_at: true, user: { select: { username: true, pen_name: true } } },
    }),
    prisma.donation.findMany({
      orderBy: { created_at: "desc" },
      take,
      select: {
        donation_id: true,
        amount: true,
        quantity: true,
        card_template: true,
        created_at: true,
        is_anonymous: true,
        gift: { select: { name_th: true } },
        from_user: { select: { username: true, pen_name: true } },
        to_user: { select: { username: true, pen_name: true } },
      },
    }),
    prisma.novel.findMany({
      where: { deleted_at: null },
      orderBy: { created_at: "desc" },
      take,
      select: { novel_id: true, title: true, visibility: true, created_at: true, author: { select: { username: true, pen_name: true } } },
    }),
    prisma.contentReport.findMany({
      orderBy: { created_at: "desc" },
      take,
      select: { report_id: true, target_type: true, reason: true, status: true, created_at: true },
    }),
  ]);

  const name = (u: { username: string; pen_name: string | null }) => u.pen_name?.trim() || u.username;
  const reportTarget: Record<string, string> = { novel: "นิยาย", chapter: "ตอน", comment: "คอมเมนต์", review: "รีวิว", user: "ผู้ใช้" };
  const reportReason: Record<string, string> = {
    spam: "สแปม",
    harassment: "คุกคาม",
    inappropriate: "ไม่เหมาะสม",
    copyright: "ละเมิดลิขสิทธิ์",
    other: "อื่น ๆ",
  };

  // ledger ของ Stripe ใช้ reference_id = stringToUuid(session id) (ดู wallet.service.ts)
  const stripeRefs = new Set(orders.map((o) => stringToUuid(o.stripe_session_id)));
  const items: Activity[] = [
    ...orders.map((o) => ({
      id: `order-${o.order_id}`,
      type: "topup" as const,
      status: (o.status === "paid" ? "success" : o.status) as ActivityStatus,
      title: `${name(o.user)} เติมเหรียญ`,
      detail: `${o.coins.toLocaleString("th-TH")} เหรียญ ผ่านบัตร`,
      amount: o.amount_thb.toNumber(),
      at: (o.paid_at ?? o.created_at).toISOString(),
    })),
    ...slipTopups
      .filter((t) => !t.reference_id || !stripeRefs.has(t.reference_id))
      .map((t) => ({
        id: `topup-${t.transaction_id}`,
        type: "topup" as const,
        status: "success" as const,
        title: `${name(t.user)} เติมเหรียญ`,
        detail: `${t.amount.toNumber().toLocaleString("th-TH")} เหรียญ`,
        amount: Object.values(COIN_PACKAGES).find((p) => p.coins === t.amount.toNumber())?.priceThb ?? t.amount.toNumber(),
        at: t.created_at.toISOString(),
      })),
    ...donations.map((d) => {
      const from = d.is_anonymous ? "ผู้ไม่ประสงค์ออกนาม" : name(d.from_user);
      return {
        id: `donation-${d.donation_id}`,
        type: (d.gift ? "gift" : "donate") as ActivityType,
        status: "success" as const,
        title: d.gift ? `${from} ส่งของขวัญให้ ${name(d.to_user)}` : `${from} โดเนทให้ ${name(d.to_user)}`,
        detail: d.gift
          ? `${d.gift.name_th} ×${d.quantity}${d.card_template ? " + การ์ดจดหมาย" : ""}`
          : `${d.amount.toNumber().toLocaleString("th-TH")} เหรียญ`,
        amount: null,
        at: d.created_at.toISOString(),
      };
    }),
    ...novels.map((n) => ({
      id: `novel-${n.novel_id}`,
      type: "novel" as const,
      status: (n.visibility === "suspended" ? "failed" : "success") as ActivityStatus,
      title: `นิยายใหม่: ${n.title}`,
      detail: `โดย ${name(n.author)}`,
      amount: null,
      at: n.created_at.toISOString(),
    })),
    ...reports.map((r) => ({
      id: `report-${r.report_id}`,
      type: "report" as const,
      status: (r.status === "open" ? "pending" : "success") as ActivityStatus,
      title: `${reportTarget[r.target_type] ?? r.target_type}ถูกรายงาน`,
      detail: `เหตุผล: ${reportReason[r.reason] ?? r.reason}`,
      amount: null,
      at: r.created_at.toISOString(),
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
}
