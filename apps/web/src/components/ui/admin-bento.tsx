"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { BookPlus, ChevronRight, Coins, Flag, Gift, HandCoins, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { handleAsync } from "@/lib/handleAsync";

// ---------------------------------------------------------------------------
// Admin Bento — หน้าภาพรวมหลังบ้าน (ดัดแปลงสไตล์จาก Web3Bento: bento grid, การ์ด rounded-[26px],
// ตัวเลข font-mono tabular-nums, count-up / แท่งกราฟโตขึ้น, hover ไฮไลต์, เคารพ prefers-reduced-motion)
//
// สี: accent = primary-500 (#F0803C ส้ม CTA ของแอป), accent2 = brand-brown (light) / brand-tan (dark)
// การ์ดสีทึบ (ระบบแนะนำ) ใช้พื้น primary-600 + ตัวอักษรขาว (≈ 3.4:1 — ขาวบน primary-500 ได้แค่ ~2.7:1)
// กล่องขาวด้านในใช้ตัวอักษร INK #2A1609
// (ตัวขาวบนส้มนี้ได้แค่ ~2.7:1 อ่านไม่ผ่าน WCAG AA)
// ---------------------------------------------------------------------------

export interface DayPoint {
  date: string; // YYYY-MM-DD (เวลาไทย)
  value: number;
}

export interface TrendingNovel {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  weeklyReads: number;
}

export type ActivityType = "topup" | "donate" | "gift" | "novel" | "report";
export type ActivityStatus = "success" | "pending" | "failed";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  detail: string;
  amount: number | null; // บาท (เฉพาะ topup)
  at: string; // ISO
}

export interface AdminDashboardData {
  revenueDaily: DayPoint[]; // บาท 60 วันล่าสุด (30 วันแรก = ช่วงเทียบ)
  topupSeries: DayPoint[]; // เหรียญที่เติม รายวัน 365 วัน
  donationSeries: DayPoint[]; // เหรียญที่โดเนท (เหรียญ + ของขวัญ) รายวัน 365 วัน
  genreAllocation: { id: string; name: string; count: number }[];
  trendingNovels: TrendingNovel[];
  pendingReports: { today: number; week: number; all: number; content?: number; gift?: number };
  hourlyChapters: { hour: string; value: number }[]; // 24 ช่อง ช่องสุดท้าย = ชั่วโมงปัจจุบัน
  todayStats: { newUsers: number; readersOnline: number; chaptersToday: number };
  recentActivity: ActivityItem[];
  /** ผลประเมินจากข้อมูลจริง (recommender_eval_runs — `npm run eval:recs:live`) null = ยังไม่เคยรัน */
  recommender: {
    threshold: number | null;
    precision: number | null;
    recall: number | null;
    f1: number | null;
    ndcg: number | null;
    baselineNdcg?: number | null; // NDCG ของ popularity baseline บน test ชุดเดียวกัน
    k?: number;
    lowData?: boolean; // ข้อมูลน้อยเกินจะมีนัยสำคัญ
    evaluatedAt?: string | null; // เวลาที่รันประเมินรอบล่าสุด
    updatedAt: string | null; // full resync กราฟ Neo4j รอบล่าสุด
    history: number[]; // NDCG ของการทดสอบ 10 ครั้งล่าสุด (เก่า → ใหม่)
  };
}

// ---------------------------------------------------------------------------
// ข้อมูลตัวอย่าง — ใช้แสดงทันที/ตอนเรียก API ไม่ได้ (สุ่มแบบมี seed ให้ server/client ได้ค่าตรงกัน)
// ---------------------------------------------------------------------------

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoDays(n: number, base: number, spread: number, seed: number): DayPoint[] {
  const rnd = seeded(seed);
  const end = Date.UTC(2026, 9, 22);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end - (n - 1 - i) * 86_400_000);
    const trend = 1 + (i / n) * 0.35;
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? 1.25 : 1;
    return { date: d.toISOString().slice(0, 10), value: Math.round(base * trend * weekend + (rnd() - 0.5) * spread) };
  });
}

export const DEMO: AdminDashboardData = {
  revenueDaily: demoDays(60, 1800, 1400, 7),
  topupSeries: demoDays(365, 1500, 1200, 11),
  donationSeries: demoDays(365, 620, 700, 13),
  genreAllocation: [
    { id: "fantasy", name: "แฟนตาซี", count: 412 },
    { id: "romance", name: "โรแมนซ์", count: 356 },
    { id: "action", name: "แอ็กชัน", count: 188 },
    { id: "mystery", name: "สืบสวน", count: 121 },
    { id: "drama", name: "ดราม่า", count: 97 },
    { id: "other", name: "อื่น ๆ", count: 140 },
  ],
  trendingNovels: [
    { id: "n1", title: "จอมเวทย์ผู้หลงทางในหอสมุดดาว", author: "ม่านหมอก", coverUrl: null, weeklyReads: 18420 },
    { id: "n2", title: "รักนี้ที่ร้านกาแฟริมทาง", author: "ชาไทยเย็น", coverUrl: null, weeklyReads: 12950 },
    { id: "n3", title: "นักล่าดันเจี้ยนระดับ F", author: "เงาจันทร์", coverUrl: null, weeklyReads: 9710 },
    { id: "n4", title: "บันทึกลับของคุณหญิงแห่งเรือนไม้", author: "ใบชา", coverUrl: null, weeklyReads: 7340 },
    { id: "n5", title: "ระบบช่วยเหลือข้ามมิติ", author: "ดาวตก", coverUrl: null, weeklyReads: 5120 },
  ],
  pendingReports: { today: 3, week: 14, all: 27 },
  hourlyChapters: Array.from({ length: 24 }, (_, i) => {
    const h = (i + 1) % 24; // ช่องสุดท้าย = ชั่วโมงปัจจุบัน
    const peak = Math.max(0, Math.sin(((h - 6) / 24) * Math.PI * 2));
    return { hour: new Date(Date.UTC(2026, 9, 21, h)).toISOString(), value: Math.round(2 + peak * 14 + ((i * 7) % 5)) };
  }),
  todayStats: { newUsers: 86, readersOnline: 342, chaptersToday: 129 },
  recentActivity: [
    { id: "a1", type: "topup", status: "success", title: "มายด์ เติมเหรียญ", detail: "410 เหรียญ ผ่านบัตร", amount: 400, at: "2026-10-22T09:42:00Z" },
    { id: "a2", type: "gift", status: "success", title: "ฟ้าใส ส่งของขวัญให้ ม่านหมอก", detail: "ช่อดอกไม้ ×2 + การ์ดจดหมาย", amount: null, at: "2026-10-22T09:30:00Z" },
    { id: "a3", type: "report", status: "pending", title: "คอมเมนต์ถูกรายงาน", detail: "เหตุผล: คุกคาม", amount: null, at: "2026-10-22T09:12:00Z" },
    { id: "a4", type: "novel", status: "pending", title: "นิยายใหม่: เสียงกระซิบจากทะเลทราย", detail: "โดย ลมร้อน", amount: null, at: "2026-10-22T08:55:00Z" },
    { id: "a5", type: "donate", status: "success", title: "ต้นกล้า โดเนทให้ ชาไทยเย็น", detail: "100 เหรียญ", amount: null, at: "2026-10-22T08:20:00Z" },
    { id: "a6", type: "topup", status: "failed", title: "บีม เติมเหรียญ", detail: "100 เหรียญ ผ่านบัตร", amount: 99, at: "2026-10-22T07:48:00Z" },
    { id: "a7", type: "topup", status: "pending", title: "ปอนด์ เติมเหรียญ", detail: "50 เหรียญ ผ่านบัตร", amount: 50, at: "2026-10-22T07:31:00Z" },
  ],
  // ค่าตัวอย่างใกล้ผลจริงของ docs/eval/recommender-eval.md (ข้อมูล seed)
  recommender: {
    threshold: 0.5,
    precision: 0.02,
    recall: 0.14,
    f1: 0.04,
    ndcg: 0.085,
    baselineNdcg: 0.062,
    k: 10,
    lowData: false,
    evaluatedAt: "2026-10-22T06:00:00Z",
    updatedAt: "2026-10-22T06:00:00Z",
    history: [0.071, 0.074, 0.078, 0.08, 0.079, 0.083, 0.082, 0.084, 0.085, 0.085],
  },
};

// ---------------------------------------------------------------------------
// ตัวช่วยที่ใช้ซ้ำ
// ---------------------------------------------------------------------------

const LOCALE = "th-TH";
const thb = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat(LOCALE);
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const pct = (v: number, digits = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(`${iso.slice(0, 10)}T12:00:00+07:00`).toLocaleDateString(LOCALE, { timeZone: "Asia/Bangkok", ...opts });

/** ตัวอักษรบนการ์ดสี primary-500 */
const INK = "#2A1609";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** true หลัง paint แรก — ใช้สั่งแท่งกราฟ/เกจให้ "โต" จาก 0 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // setTimeout ไม่ใช่ rAF — แท็บที่เปิดค้างไว้เบื้องหลังจะไม่ยิง rAF จนกว่าจะสลับมา แท่งกราฟจะค้างที่ 0
    const id = window.setTimeout(() => setMounted(true), 30);
    return () => window.clearTimeout(id);
  }, []);
  return mounted;
}

/** นับเลขขึ้นจากค่าเดิมไปค่าใหม่ (ease-out cubic) — reduced motion แสดงค่าจริงทันที */
export function useCountUp(target: number, duration = 900) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    if (reduced) {
      current.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const from = current.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      current.current = from + (target - from) * eased;
      setValue(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return value;
}

/** เส้นโค้งนุ่มผ่านทุกจุด (Catmull-Rom → cubic Bézier) */
export function smooth(points: [number, number][], tension = 0.2) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * tension;
    const c1y = p1[1] + (p2[1] - p0[1]) * tension;
    const c2x = p2[0] - (p3[0] - p1[0]) * tension;
    const c2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// ชิ้นส่วน UI พื้นฐาน
// ---------------------------------------------------------------------------

export function Tile({
  className,
  children,
  solid = false,
  label,
}: {
  className?: string;
  children: ReactNode;
  solid?: boolean;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "group/tile relative flex min-w-0 flex-col overflow-hidden rounded-[26px] p-5 transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none",
        solid
          ? "bg-primary-600 text-white shadow-[0_10px_30px_-12px_rgba(219,107,40,0.6)]"
          : "border border-neutral-200 bg-white hover:border-primary-300 hover:shadow-[0_8px_28px_-16px_rgba(240,128,60,0.45)] dark:hover:border-primary-500/50",
        className
      )}
    >
      {children}
    </section>
  );
}

function TileHeader({ title, right, sub }: { title: string; right?: ReactNode; sub?: string }) {
  return (
    <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {sub && <p className="text-xs text-neutral-500">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Pills<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-full bg-neutral-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none",
            value === o.value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-neutral-400">ไม่มีข้อมูลเทียบ</span>;
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
        up
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
      )}
    >
      {up ? "▲" : "▼"} {pct(value)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 1) Hero — สวัสดีแอดมิน + รายได้เติมเหรียญ 30 วัน
// ---------------------------------------------------------------------------

function HeroTile({ adminName, revenueDaily }: { adminName: string; revenueDaily: DayPoint[] }) {
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const last30 = revenueDaily.slice(-30);
  const prev30 = revenueDaily.slice(-60, -30);
  const total = last30.reduce((s, d) => s + d.value, 0);
  const prevTotal = prev30.reduce((s, d) => s + d.value, 0);
  const change = prev30.length > 0 && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const shown = useCountUp(total);
  const max = Math.max(1, ...last30.map((d) => d.value));
  const [hover, setHover] = useState<number | null>(null);
  const active = hover !== null ? last30[hover] : null;

  return (
    <Tile className="sm:col-span-2 xl:col-start-1 xl:row-start-1" label="รายได้เติมเหรียญ">
      <p className="text-sm text-neutral-500">สวัสดี, {adminName} 👋</p>
      <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="font-mono text-3xl font-bold tabular-nums tracking-tight text-neutral-900 sm:text-4xl">
          {thb.format(Math.round(shown))}
        </p>
        <Delta value={change} />
      </div>
      <p className="mt-0.5 text-xs text-neutral-500">รายได้เติมเหรียญ 30 วันล่าสุด · เทียบ 30 วันก่อนหน้า</p>

      <div className="mt-auto pt-4">
        <div className="mb-1 h-4 text-right font-mono text-[11px] tabular-nums text-neutral-500" aria-live="polite">
          {active ? `${fmtDay(active.date)} · ${thb.format(active.value)}` : " "}
        </div>
        <div className="flex h-20 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
          {last30.map((d, i) => (
            <button
              key={d.date}
              type="button"
              aria-label={`${fmtDay(d.date)} ${thb.format(d.value)}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="flex h-full flex-1 items-end focus:outline-none"
            >
              <span
                className={cn(
                  "block w-full origin-bottom rounded-t-[3px] transition-[transform,background-color] duration-700 ease-out motion-reduce:transition-none",
                  hover === null
                    ? i === last30.length - 1
                      ? "bg-brand-brown dark:bg-brand-tan"
                      : "bg-primary-500"
                    : hover === i
                      ? "bg-primary-500"
                      : "bg-primary-200 dark:bg-primary-800"
                )}
                style={{
                  height: `${Math.max(4, (d.value / max) * 100)}%`,
                  transform: mounted || reduced ? "scaleY(1)" : "scaleY(0)",
                  transitionDelay: reduced ? "0ms" : `${i * 18}ms`,
                }}
              />
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
          <span>{last30[0] && fmtDay(last30[0].date)}</span>
          <span>วันนี้</span>
        </div>
      </div>
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// 2) นิยายมาแรง — อันดับยอดอ่านสัปดาห์นี้ (ไม่ใช้รูปปก) แถบยาวตามสัดส่วนยอดอ่านเทียบอันดับ 1
// ---------------------------------------------------------------------------

function TrendingTile({ novels }: { novels: TrendingNovel[] }) {
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const top = novels[0]?.weeklyReads || 1;
  const total = novels.reduce((s, n) => s + n.weeklyReads, 0);

  return (
    <Tile className="xl:col-start-3 xl:row-span-2 xl:row-start-1" label="นิยายมาแรง">
      <TileHeader title="นิยายมาแรง" sub="ยอดอ่านสูงสุดสัปดาห์นี้" />
      {novels.length === 0 ? (
        <p className="m-auto py-10 text-sm text-neutral-400">ยังไม่มียอดอ่านสัปดาห์นี้</p>
      ) : (
        <>
          <ol className="flex flex-1 flex-col gap-1">
            {novels.map((n, i) => (
              <TrendingRow key={n.id} novel={n} rank={i + 1} ratio={n.weeklyReads / top} grow={mounted || reduced} delay={reduced ? 0 : i * 90} />
            ))}
          </ol>
          <div className="mt-3 flex items-baseline justify-between border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
            <span>รวม {novels.length} อันดับแรก</span>
            <span className="font-mono font-semibold tabular-nums text-neutral-900">{num.format(total)} ครั้ง</span>
          </div>
        </>
      )}
    </Tile>
  );
}

function TrendingRow({
  novel,
  rank,
  ratio,
  grow,
  delay,
}: {
  novel: TrendingNovel;
  rank: number;
  ratio: number;
  grow: boolean;
  delay: number;
}) {
  const reads = useCountUp(novel.weeklyReads, 700);
  const first = rank === 1;
  return (
    <li>
      <Link
        href={`/novels/${novel.id}`}
        className={cn(
          "group/row flex items-start gap-3 rounded-2xl px-2.5 py-2 transition-colors motion-reduce:transition-none",
          first ? "bg-primary-50 dark:bg-primary-500/10" : "hover:bg-neutral-50"
        )}
      >
        <span
          className={cn(
            "w-6 shrink-0 text-center font-mono font-bold tabular-nums leading-none",
            first ? "pt-0.5 text-2xl text-primary-500" : "pt-1 text-lg text-neutral-300"
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900 group-hover/row:text-primary-600">{novel.title}</p>
          <p className="truncate text-[11px] text-neutral-500">โดย {novel.author}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <span
                className={cn(
                  "block h-full origin-left rounded-full transition-transform duration-700 ease-out motion-reduce:transition-none",
                  first ? "bg-primary-500" : "bg-brand-tan-dark dark:bg-brand-tan"
                )}
                style={{ width: `${Math.max(4, ratio * 100)}%`, transform: grow ? "scaleX(1)" : "scaleX(0)", transitionDelay: `${delay}ms` }}
              />
            </span>
            <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-neutral-900">{compact.format(Math.round(reads))}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// 3) รายงานรอตรวจสอบ — เกจครึ่งวงกลม
// ---------------------------------------------------------------------------

type ReportRange = "today" | "week" | "all";

function ReportsTile({ reports }: { reports: AdminDashboardData["pendingReports"] }) {
  const [range, setRange] = useState<ReportRange>("all");
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const value = reports[range];
  const shown = useCountUp(value, 600);
  // เต็มเกจ = 125% ของงานค้างทั้งหมด (อย่างน้อย 10) — ใกล้เต็มคือค้างเยอะ
  const max = Math.max(10, Math.ceil((reports.all * 1.25) / 5) * 5);
  const ratio = Math.min(1, value / max);
  const r = 70;
  const arc = Math.PI * r;
  const level =
    ratio > 0.66 ? "stroke-rose-500" : ratio > 0.33 ? "stroke-primary-500" : "stroke-emerald-500";

  return (
    <Tile className="xl:col-start-4 xl:row-start-1" label="รายงานรอตรวจสอบ">
      <TileHeader
        title="รายงานรอตรวจสอบ"
        right={
          <Pills
            label="ช่วงเวลา"
            value={range}
            onChange={setRange}
            options={[
              { value: "today", label: "วันนี้" },
              { value: "week", label: "สัปดาห์" },
              { value: "all", label: "ทั้งหมด" },
            ]}
          />
        }
      />
      <div className="relative mx-auto mt-1 w-full max-w-[220px]">
        <svg viewBox="0 0 180 100" className="w-full" role="img" aria-label={`รอตรวจ ${value} รายการ`}>
          <path d={`M20,90 A${r},${r} 0 0 1 160,90`} fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-neutral-100" />
          <path
            d={`M20,90 A${r},${r} 0 0 1 160,90`}
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            className={cn(level, "transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none")}
            strokeDasharray={arc}
            strokeDashoffset={mounted || reduced ? arc * (1 - ratio) : arc}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="font-mono text-3xl font-bold tabular-nums text-neutral-900">{Math.round(shown)}</p>
          <p className="text-[11px] text-neutral-500">จากสเกล {max}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-3 text-xs">
        <span className="text-neutral-500">
          {reports.content !== undefined && reports.gift !== undefined
            ? `เนื้อหา ${reports.content} · การ์ดของขวัญ ${reports.gift}`
            : "รายงานเนื้อหา + การ์ดของขวัญ"}
        </span>
        <Link href="/admin/content-reports" className="inline-flex shrink-0 items-center whitespace-nowrap font-medium text-primary-600 hover:underline">
          ตรวจเลย <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// 4) ยอดเติมเหรียญ vs ยอดโดเนทนักเขียน
// ---------------------------------------------------------------------------

type ChartRange = "1W" | "1M" | "1Y";

function bucket(series: DayPoint[], range: ChartRange): DayPoint[] {
  if (range === "1W") return series.slice(-7);
  if (range === "1M") return series.slice(-30);
  // 1Y — รวมเป็นรายสัปดาห์ 52 จุด (ลงท้ายที่วันนี้)
  const last = series.slice(-364);
  const out: DayPoint[] = [];
  for (let i = 0; i < last.length; i += 7) {
    const chunk = last.slice(i, i + 7);
    out.push({ date: chunk[0].date, value: chunk.reduce((s, d) => s + d.value, 0) });
  }
  return out;
}

function ChartTile({ topup, donation }: { topup: DayPoint[]; donation: DayPoint[] }) {
  const [range, setRange] = useState<ChartRange>("1M");
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");
  const a = useMemo(() => bucket(topup, range), [topup, range]);
  const b = useMemo(() => bucket(donation, range), [donation, range]);
  const sumA = a.reduce((s, d) => s + d.value, 0);
  const sumB = b.reduce((s, d) => s + d.value, 0);
  const passThrough = sumA > 0 ? (sumB / sumA) * 100 : 0;
  const shownA = useCountUp(sumA, 700);

  const W = 600;
  const H = 200;
  const pad = { t: 10, b: 8 };
  const max = Math.max(1, ...a.map((d) => d.value), ...b.map((d) => d.value)) * 1.1;
  const x = (i: number, n: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const ptsA = a.map((d, i) => [x(i, a.length), y(d.value)] as [number, number]);
  const ptsB = b.map((d, i) => [x(i, b.length), y(d.value)] as [number, number]);
  const lineA = smooth(ptsA);
  const lineB = smooth(ptsB);
  const area = ptsA.length ? `${lineA} L${W},${H} L0,${H} Z` : "";
  const active = hover !== null ? { a: a[hover], b: b[hover] } : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(a.length - 1, Math.round(rel * (a.length - 1)))));
  };

  return (
    <Tile className="sm:col-span-2 xl:col-start-1 xl:row-span-2 xl:row-start-2" label="ยอดเติมเหรียญเทียบยอดโดเนท">
      <TileHeader
        title="ยอดเติมเหรียญ vs ยอดโดเนทนักเขียน"
        sub="หน่วย: เหรียญ · โดเนท = เหรียญ + ของขวัญ"
        right={
          <Pills
            label="ช่วงเวลา"
            value={range}
            onChange={(v) => {
              setRange(v);
              setHover(null);
            }}
            options={[
              { value: "1W", label: "1W" },
              { value: "1M", label: "1M" },
              { value: "1Y", label: "1Y" },
            ]}
          />
        }
      />
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div>
          <p className="font-mono text-2xl font-bold tabular-nums text-neutral-900">{num.format(Math.round(shownA))}</p>
          <p className="text-[11px] text-neutral-500">เหรียญที่เติมในช่วงนี้</p>
        </div>
        <span
          className="rounded-full bg-primary-50 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-primary-700 dark:bg-primary-500/15 dark:text-primary-300"
          title="ยอดโดเนท ÷ ยอดเติมเหรียญ ในช่วงที่เลือก"
        >
          ส่งต่อให้นักเขียน {passThrough.toFixed(1)}%
        </span>
        <div className="ml-auto flex gap-3 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-primary-500" /> เติมเหรียญ
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="2" aria-hidden>
              <line x1="0" y1="1" x2="16" y2="1" strokeWidth="2" strokeDasharray="3 3" className="stroke-brand-brown dark:stroke-brand-tan" />
            </svg>
            โดเนท
          </span>
        </div>
      </div>

      <div className="relative mt-3 min-h-[180px] flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full touch-none overflow-visible"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`เติมเหรียญ ${num.format(sumA)} เหรียญ, โดเนท ${num.format(sumB)} เหรียญ`}
        >
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#F0803C" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#F0803C" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} className="stroke-neutral-100" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill={`url(#${gradId})`} />
          <path d={lineA} fill="none" strokeWidth="2.5" className="stroke-primary-500" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path
            d={lineB}
            fill="none"
            strokeWidth="2"
            strokeDasharray="5 5"
            className="stroke-brand-brown dark:stroke-brand-tan"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
          {hover !== null && ptsA[hover] && (
            <line x1={ptsA[hover][0]} x2={ptsA[hover][0]} y1="0" y2={H} className="stroke-neutral-300" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {active && active.a && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] shadow-md"
            style={{ left: `${Math.min(88, Math.max(12, (ptsA[hover!][0] / W) * 100))}%` }}
          >
            <p className="font-medium text-neutral-700">
              {range === "1Y" ? `สัปดาห์ของ ${fmtDay(active.a.date)}` : fmtDay(active.a.date, { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <p className="font-mono tabular-nums text-primary-600">เติม {num.format(active.a.value)}</p>
            <p className="font-mono tabular-nums text-brand-brown dark:text-brand-tan">โดเนท {num.format(active.b?.value ?? 0)}</p>
          </div>
        )}
      </div>
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// 5) สัดส่วนหมวดหมู่นิยาย
// ---------------------------------------------------------------------------

const GENRE_COLORS = [
  "bg-primary-500",
  "bg-brand-brown dark:bg-brand-tan",
  "bg-primary-300",
  "bg-brand-tan-dark",
  "bg-primary-700 dark:bg-primary-200",
  "bg-neutral-300",
];

function AllocationTile({ genres }: { genres: AdminDashboardData["genreAllocation"] }) {
  const total = genres.reduce((s, g) => s + g.count, 0);
  const [hover, setHover] = useState<string | null>(null);
  const mounted = useMounted();
  const reduced = useReducedMotion();

  return (
    <Tile className="xl:col-start-3 xl:row-start-3" label="สัดส่วนหมวดหมู่นิยาย">
      <TileHeader title="สัดส่วนหมวดหมู่นิยาย" sub={`นิยายที่เผยแพร่ ${num.format(total)} เรื่อง`} />
      {total === 0 ? (
        <p className="m-auto py-6 text-sm text-neutral-400">ยังไม่มีนิยายที่ระบุหมวด</p>
      ) : (
        <>
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" onMouseLeave={() => setHover(null)}>
            {genres.map((g, i) => (
              <span
                key={g.id}
                onMouseEnter={() => setHover(g.id)}
                className={cn(
                  "h-full transition-[flex-grow,opacity] duration-700 ease-out first:rounded-l-full last:rounded-r-full motion-reduce:transition-none",
                  GENRE_COLORS[i % GENRE_COLORS.length],
                  hover && hover !== g.id && "opacity-30"
                )}
                style={{ flexGrow: mounted || reduced ? g.count : 0, flexBasis: 0 }}
                title={`${g.name} ${((g.count / total) * 100).toFixed(1)}%`}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5" onMouseLeave={() => setHover(null)}>
            {genres.map((g, i) => (
              <li
                key={g.id}
                onMouseEnter={() => setHover(g.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-1.5 py-0.5 text-xs transition-colors",
                  hover === g.id ? "bg-neutral-100" : hover && "opacity-50"
                )}
              >
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", GENRE_COLORS[i % GENRE_COLORS.length])} />
                <span className="flex-1 truncate text-neutral-700" title={`${g.name} · ${num.format(g.count)} เรื่อง`}>
                  {g.name}
                </span>
                <span className="w-12 text-right font-mono font-semibold tabular-nums text-neutral-900">
                  {((g.count / total) * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// 6) ระบบแนะนำ — การ์ดสีทึบ
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null) {
  if (!iso) return "ยังไม่มีข้อมูล (รอรอบ resync ถัดไป)";
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const min = Math.round(diff / 60_000);
  if (Math.abs(min) < 60) return rtf.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(-hr, "hour");
  return rtf.format(-Math.round(hr / 24), "day");
}

function RecommenderTile({
  rec,
  onResync,
}: {
  rec: AdminDashboardData["recommender"];
  onResync?: () => Promise<string | null>;
}) {
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const shown = useCountUp((rec.threshold ?? 0) * 100, 800);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(rec.updatedAt);
  useEffect(() => setUpdatedAt(rec.updatedAt), [rec.updatedAt]);
  const hmax = Math.max(0.01, ...rec.history);
  const hmin = Math.min(...rec.history, hmax) * 0.9;
  const hasEval = rec.ndcg !== null;
  const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "—" : v.toFixed(d));
  const k = rec.k ?? 10;

  const metrics = [
    { label: "Precision", value: rec.precision },
    { label: "Recall", value: rec.recall },
    { label: "F1", value: rec.f1 },
    { label: "NDCG", value: rec.ndcg },
  ];

  const run = async () => {
    if (!onResync || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const at = await onResync();
      if (at) setUpdatedAt(at);
      setMessage("สร้างความสัมพันธ์ใหม่เรียบร้อย");
    } catch {
      setMessage("ทำไม่สำเร็จ — Neo4j อาจยังไม่พร้อม (ดู log ของ API)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tile solid className="sm:col-start-2 xl:col-start-4 xl:row-span-2 xl:row-start-2" label="ระบบแนะนำ">
      <h3 className="text-sm font-semibold">ระบบแนะนำ</h3>
      <p className="text-xs font-medium text-white/90">Similarity threshold ปัจจุบัน</p>
      <p className="mt-1 font-mono text-5xl font-bold tabular-nums tracking-tight">{hasEval ? (shown / 100).toFixed(2) : "—"}</p>

      {/* กล่องขาวบนพื้นส้ม (ค่าสีตรง เพราะ bg-white ของแอปกลายเป็นสีเข้มในโหมดมืด) — เดิมเป็นดำโปร่ง 7% กลืนกับพื้นจนแทบไม่เห็นขอบ */}
      <p className="mt-4 text-[11px] font-medium text-white/90">
        {hasEval ? `ผลประเมินที่ Top-${k} · ${relativeTime(rec.evaluatedAt ?? null)}` : "ยังไม่มีผลประเมิน — รัน npm run eval:recs:live"}
      </p>
      <dl className="mt-1.5 grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl bg-[#ffffffe6] px-3 py-2 shadow-sm" style={{ color: INK }}>
            <dt className="truncate text-[11px] font-medium opacity-70">{m.label}</dt>
            <dd className="font-mono text-lg font-bold tabular-nums">{fmt(m.value)}</dd>
          </div>
        ))}
      </dl>
      {hasEval && (
        <p className="mt-1.5 text-[11px] font-medium text-white/90">
          baseline ยอดนิยม NDCG {fmt(rec.baselineNdcg, 3)}
          {rec.lowData ? " · ข้อมูลน้อย ผลยังไม่มีนัยสำคัญ" : ""}
        </p>
      )}

      <div className="mt-3 rounded-2xl bg-[#ffffffe6] px-3 pb-2.5 pt-2 shadow-sm" style={{ color: INK }}>
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="font-medium opacity-80">NDCG ทดสอบ {rec.history.length} ครั้งล่าสุด</span>
          <span className="font-mono font-bold tabular-nums">{fmt(rec.history.at(-1), 3)}</span>
        </div>
        <div className="mt-1.5 flex h-14 items-end gap-1">
          {rec.history.map((v, i) => (
            <span
              key={i}
              title={`ครั้งที่ ${i + 1}: ${v.toFixed(3)}`}
              className={cn(
                "flex-1 origin-bottom rounded-t-[4px] transition-transform duration-700 ease-out motion-reduce:transition-none",
                i === rec.history.length - 1 ? "" : "bg-primary-300"
              )}
              style={{
                height: `${Math.max(8, ((v - hmin) / (hmax - hmin || 1)) * 100)}%`,
                backgroundColor: i === rec.history.length - 1 ? INK : undefined,
                transform: mounted || reduced ? "scaleY(1)" : "scaleY(0)",
                transitionDelay: reduced ? "0ms" : `${i * 40}ms`,
              }}
            />
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] font-medium text-white/90">อัปเดตกราฟ Neo4j ล่าสุด: {relativeTime(updatedAt)}</p>

      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={handleAsync(run)}
          disabled={!onResync || busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-50 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          style={{ backgroundColor: INK }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw className="h-4 w-4" />}
          {busy ? "กำลังสร้าง…" : "สร้างความสัมพันธ์ผู้ใช้ใหม่"}
        </button>
        <p className="mt-1.5 min-h-[1rem] text-center text-[11px] font-medium" aria-live="polite">
          {busy ? "อาจใช้เวลาหลายนาที ปิดหน้านี้ได้ งานยังรันต่อ" : message}
        </p>
      </div>
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// 7) ตอนใหม่ที่เผยแพร่ — แท่งรายชั่วโมง 24 ชม.
// ---------------------------------------------------------------------------

function ChaptersTile({
  hourly,
  today,
}: {
  hourly: AdminDashboardData["hourlyChapters"];
  today: AdminDashboardData["todayStats"];
}) {
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...hourly.map((h) => h.value));
  const total = hourly.reduce((s, h) => s + h.value, 0);
  const hourLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  const active = hover !== null ? hourly[hover] : null;

  const stats = [
    { label: "ผู้ใช้ใหม่วันนี้", value: today.newUsers },
    { label: "ผู้อ่านออนไลน์", value: today.readersOnline, live: true },
    { label: "ตอนใหม่วันนี้", value: today.chaptersToday },
  ];

  return (
    <Tile className="sm:col-span-2 xl:col-start-1 xl:row-start-4" label="ตอนใหม่ที่เผยแพร่">
      <TileHeader
        title="ตอนใหม่ที่เผยแพร่"
        sub={`24 ชั่วโมงล่าสุด · รวม ${num.format(total)} ตอน`}
        right={
          <span className="font-mono text-[11px] tabular-nums text-neutral-500" aria-live="polite">
            {active ? `${hourLabel(active.hour)} · ${active.value} ตอน` : ""}
          </span>
        }
      />
      <div className="flex h-16 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        {hourly.map((h, i) => {
          const latest = i === hourly.length - 1;
          return (
            <span
              key={h.hour}
              onMouseEnter={() => setHover(i)}
              title={`${hourLabel(h.hour)} — ${h.value} ตอน`}
              className={cn(
                "flex-1 origin-bottom rounded-[3px] transition-[transform,background-color] duration-500 ease-out motion-reduce:transition-none",
                hover === i || (hover === null && latest)
                  ? "bg-primary-500"
                  : h.value === 0
                    ? "bg-neutral-100"
                    : "bg-primary-200 dark:bg-primary-800",
                latest && hover === null && !reduced && "motion-safe:animate-pulse"
              )}
              style={{
                height: `${Math.max(6, (h.value / max) * 100)}%`,
                transform: mounted || reduced ? "scaleY(1)" : "scaleY(0)",
                transitionDelay: reduced ? "0ms" : `${i * 20}ms`,
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
        <span>{hourly[0] && hourLabel(hourly[0].hour)}</span>
        <span>ตอนนี้</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <StatCell key={s.label} {...s} />
        ))}
      </dl>
    </Tile>
  );
}

function StatCell({ label, value, live }: { label: string; value: number; live?: boolean }) {
  const shown = useCountUp(value, 700);
  return (
    <div className="rounded-2xl bg-neutral-50 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[11px] text-neutral-500">
        {live && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="font-mono text-lg font-bold tabular-nums text-neutral-900">{num.format(Math.round(shown))}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8) กิจกรรมล่าสุด
// ---------------------------------------------------------------------------

const ACTIVITY_META: Record<ActivityType, { icon: typeof Coins; label: string; tint: string }> = {
  topup: { icon: Coins, label: "เติมเหรียญ", tint: "bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300" },
  donate: { icon: HandCoins, label: "โดเนท", tint: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  gift: { icon: Gift, label: "ของขวัญ", tint: "bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300" },
  novel: { icon: BookPlus, label: "นิยายใหม่", tint: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" },
  report: { icon: Flag, label: "รายงาน", tint: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" },
};

const STATUS_META: Record<ActivityStatus, { label: string; className: string }> = {
  success: { label: "สำเร็จ", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  pending: { label: "รอดำเนินการ", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  failed: { label: "ล้มเหลว", className: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

function ActivityTile({ items }: { items: ActivityItem[] }) {
  const time = (iso: string) =>
    new Date(iso).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

  return (
    <Tile className="sm:col-span-2 xl:col-start-3 xl:row-start-4" label="กิจกรรมล่าสุด">
      <TileHeader title="กิจกรรมล่าสุด" />
      {items.length === 0 ? (
        <p className="m-auto py-6 text-sm text-neutral-400">ยังไม่มีกิจกรรม</p>
      ) : (
        <ul className="-mx-2 max-h-[260px] space-y-0.5 overflow-y-auto pr-1 scrollbar-hide">
          {items.map((a) => {
            const meta = ACTIVITY_META[a.type];
            const status = STATUS_META[a.status];
            const Icon = meta.icon;
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-neutral-50">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.tint)} title={meta.label}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{a.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {a.detail} · {time(a.at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {a.amount !== null && <span className="font-mono text-xs font-semibold tabular-nums text-neutral-900">{thb.format(a.amount)}</span>}
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", status.className)}>{status.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Grid — มือถือ 1 คอลัมน์ / sm–lg 2 / xl 4 (4 แถว) — หน้าแอดมินมีเมนูซ้ายกินที่ตั้งแต่ lg
// ที่ lg (1024px) เนื้อหาเหลือ ~560px จึงเริ่ม 4 คอลัมน์ที่ xl แทน:
//   xl:  [ Hero  Hero | Trend | Reports ]
//        [ Chart Chart | Trend | Rec     ]
//        [ Chart Chart | Alloc | Rec     ]
//        [ Chap  Chap  | Activity  ×2    ]
//   sm/lg:  Hero×2 / Trend Reports / Chart×2 / Alloc Rec / Chap×2 / Activity×2
// ---------------------------------------------------------------------------

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:auto-rows-[minmax(180px,auto)]";

export function AdminBento({
  data,
  adminName = "แอดมิน",
  onResync,
}: {
  data?: Partial<AdminDashboardData>;
  adminName?: string;
  onResync?: () => Promise<string | null>;
}) {
  const d: AdminDashboardData = { ...DEMO, ...data };
  return (
    <div className={GRID}>
      <HeroTile adminName={adminName} revenueDaily={d.revenueDaily} />
      <TrendingTile novels={d.trendingNovels} />
      <ReportsTile reports={d.pendingReports} />
      <ChartTile topup={d.topupSeries} donation={d.donationSeries} />
      <AllocationTile genres={d.genreAllocation} />
      <RecommenderTile rec={d.recommender} onResync={onResync} />
      <ChaptersTile hourly={d.hourlyChapters} today={d.todayStats} />
      <ActivityTile items={d.recentActivity} />
    </div>
  );
}

/** โครงกระดูกระหว่างโหลด — ตำแหน่ง/ขนาดเดียวกับ tile จริง */
export function AdminBentoSkeleton() {
  const block = "rounded-[26px] border border-neutral-200 bg-white p-5";
  const bar = "rounded-full bg-neutral-100 motion-safe:animate-pulse";
  return (
    <div className={GRID} aria-busy="true" aria-label="กำลังโหลดภาพรวม">
      <div className={cn(block, "sm:col-span-2 xl:col-start-1 xl:row-start-1")}>
        <div className={cn(bar, "h-3 w-28")} />
        <div className={cn(bar, "mt-3 h-9 w-48")} />
        <div className="mt-6 flex h-20 items-end gap-[3px]">
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} className="flex-1 rounded-t-[3px] bg-neutral-100 motion-safe:animate-pulse" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
          ))}
        </div>
      </div>
      <div className={cn(block, "xl:col-start-3 xl:row-span-2 xl:row-start-1")}>
        <div className={cn(bar, "h-3 w-24")} />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="mt-4 flex gap-3">
            <div className="h-5 w-5 rounded-md bg-neutral-100 motion-safe:animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className={cn(bar, "h-3 w-4/5")} />
              <div className={cn(bar, "h-1.5 w-full")} />
            </div>
          </div>
        ))}
      </div>
      <div className={cn(block, "xl:col-start-4 xl:row-start-1")}>
        <div className={cn(bar, "h-3 w-28")} />
        <div className="mx-auto mt-5 h-20 w-40 rounded-t-full bg-neutral-100 motion-safe:animate-pulse" />
      </div>
      <div className={cn(block, "min-h-[300px] sm:col-span-2 xl:col-start-1 xl:row-span-2 xl:row-start-2")}>
        <div className={cn(bar, "h-3 w-56")} />
        <div className={cn(bar, "mt-3 h-7 w-32")} />
        <div className="mt-6 h-40 rounded-2xl bg-neutral-100 motion-safe:animate-pulse" />
      </div>
      <div className={cn(block, "xl:col-start-3 xl:row-start-3")}>
        <div className={cn(bar, "h-3 w-36")} />
        <div className={cn(bar, "mt-4 h-3 w-full")} />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={cn(bar, "mt-3 h-2.5 w-full")} />
        ))}
      </div>
      <div className="min-h-[300px] rounded-[26px] bg-primary-600/40 p-5 motion-safe:animate-pulse sm:col-start-2 xl:col-start-4 xl:row-span-2 xl:row-start-2" />
      <div className={cn(block, "sm:col-span-2 xl:col-start-1 xl:row-start-4")}>
        <div className={cn(bar, "h-3 w-32")} />
        <div className="mt-4 h-16 rounded-xl bg-neutral-100 motion-safe:animate-pulse" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-14 rounded-2xl bg-neutral-100 motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
      <div className={cn(block, "sm:col-span-2 xl:col-start-3 xl:row-start-4")}>
        <div className={cn(bar, "h-3 w-28")} />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="mt-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-neutral-100 motion-safe:animate-pulse" />
            <div className={cn(bar, "h-3 flex-1")} />
          </div>
        ))}
      </div>
    </div>
  );
}
