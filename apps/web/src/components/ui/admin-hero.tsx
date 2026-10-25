"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Coins,
  FileText,
  Flag,
  Gift,
  PawPrint,
  RefreshCw,
  Settings,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatRelativeThai } from "@/lib/format";
import { getPenName } from "@/lib/displayName";
import type { AdminStats } from "@/lib/adminStats";
import { handleAsync } from "@/lib/handleAsync";

interface ActivityUser {
  user_id: string;
  username: string;
  pen_name: string | null;
}

/** GET /admin/reports/activity */
interface ActivityItem {
  id: string;
  kind: "topup" | "gift";
  coins: number;
  amount_thb: number | null;
  user: ActivityUser;
  recipient: ActivityUser | null;
  gift_name: string | null;
  quantity: number;
  created_at: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; stats: AdminStats; activity: ActivityItem[] };

// ทางลัดไปหน้าหลังบ้านที่มีอยู่จริง (ดู AdminSidebar) — ยังไม่มีหน้า Stripe/ตั้งค่าแยก
// จึงชี้ "เหรียญ" ไปคำขอถอนเงิน และ "ตั้งค่า" ไปจัดการแท็ก
const shortcuts: { href: string; label: string; icon: LucideIcon; tint: string }[] = [
  { href: "/admin/users", label: "ผู้ใช้", icon: Users, tint: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { href: "/admin/novels", label: "นิยาย", icon: BookOpen, tint: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { href: "/admin/content-reports", label: "รายงาน", icon: ShieldAlert, tint: "bg-red-500/15 text-red-600 dark:text-red-400" },
  { href: "/admin/withdrawals", label: "เหรียญ/ถอนเงิน", icon: Coins, tint: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { href: "/admin/gifts", label: "ของขวัญ", icon: Gift, tint: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
  { href: "/admin/tags", label: "ตั้งค่าแท็ก", icon: Settings, tint: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
];

/**
 * Hero หน้าภาพรวมหลังบ้าน — ซ้ายเป็นหัวข้อ + ปุ่ม ขวาเป็น mockup หน้าต่างเดสก์ท็อป (ภาพรวมระบบ + ทางลัด)
 * และโทรศัพท์ (กิจกรรมล่าสุด) ข้อมูลจริงจาก /admin/reports/stats และ /admin/reports/activity
 * mockup ใช้ neutral/bg-white ของแอป — สว่างในโหมดปกติ และกลับสีเองในโหมดมืด
 */
export function AdminHero() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const [stats, activity] = await Promise.all([
        apiClient.get<AdminStats>("/admin/reports/stats"),
        apiClient.get<{ items: ActivityItem[] }>("/admin/reports/activity"),
      ]);
      setState({ status: "ready", stats: stats.data, activity: activity.data.items });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mb-5 overflow-hidden rounded-card border border-neutral-200 bg-white">
      <div className="grid items-center gap-8 p-5 sm:p-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ---- ซ้าย: หัวข้อ + ปุ่ม ---- */}
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
            ผู้ดูแลระบบ
          </span>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-neutral-900 sm:text-3xl">
            แผงควบคุมผู้ดูแล BuddyBook
          </h2>
          <p className="mt-3 text-sm text-neutral-500 sm:text-base">
            จัดการนิยาย ผู้ใช้ รายงาน และธุรกรรมเหรียญได้ในที่เดียว
          </p>
          <div className="mt-6 flex flex-wrap gap-3 max-sm:flex-col">
            <Link href="/admin/novels" className={buttonClasses({ size: "lg", className: "max-sm:w-full" })}>
              จัดการนิยาย
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/admin/content-reports"
              className={buttonClasses({ variant: "outline", size: "lg", className: "max-sm:w-full" })}
            >
              ดูรายงาน
            </Link>
          </div>
        </div>

        {/* ---- ขวา: mockup ---- */}
        {/* sm+ โทรศัพท์วางข้างหน้าต่างและซ้อนขอบขวาล่างเล็กน้อย (ไม่บังทางลัด) / มือถือเรียงต่อกันลงมา */}
        <div className="min-w-0 sm:flex sm:items-end sm:pb-4">
          <div className="min-w-0 sm:flex-1">
            <DesktopWindow state={state} onRetry={handleAsync(load)} />
          </div>
          <div className="mt-4 sm:relative sm:-ml-6 sm:mt-0 sm:w-48 sm:shrink-0 sm:translate-y-4">
            <PhoneMockup state={state} onRetry={handleAsync(load)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function DesktopWindow({ state, onRetry }: { state: LoadState; onRetry: () => void }) {
  const stats = state.status === "ready" ? state.stats : null;
  const overview = [
    { label: "ผู้ใช้", value: stats?.total_users, icon: Users },
    { label: "นิยาย", value: stats?.total_novels, icon: BookOpen },
    { label: "ตอน", value: stats?.total_chapters, icon: FileText },
    {
      label: "รายงานรอตรวจ",
      value: stats ? stats.open_content_reports + stats.open_gift_reports : undefined,
      icon: Flag,
      alert: true,
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-800 shadow-xl">
      {/* แถบหัวหน้าต่าง */}
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-bold tracking-tight text-brand-brown dark:text-brand-tan">
          <PawPrint className="h-4 w-4 -rotate-12" fill="currentColor" />
          BuddyBook
        </span>
        <span className="ml-auto text-[11px] text-neutral-400">หลังบ้าน</span>
      </div>

      <div className="space-y-4 p-4 sm:pr-10">
        {/* ภาพรวมระบบ */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-500">ภาพรวมระบบ</p>
            {state.status === "error" && <RetryButton onRetry={onRetry} />}
          </div>
          {state.status === "error" ? (
            <ErrorNote text="โหลดสถิติไม่สำเร็จ" />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
              {overview.map((o) => {
                const highlight = o.alert && !!o.value;
                return (
                  <div
                    key={o.label}
                    className={cn(
                      "rounded-lg border px-3 py-2.5",
                      highlight ? "border-primary-500/40 bg-primary-500/10" : "border-neutral-200 bg-neutral-50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <o.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="leading-tight">{o.label}</span>
                    </div>
                    {o.value === undefined ? (
                      <div className="mt-1.5 h-6 w-12 animate-pulse rounded bg-neutral-200" />
                    ) : (
                      <p className={cn("mt-1 text-xl font-bold", highlight ? "text-primary-600 dark:text-primary-300" : "text-neutral-900")}>
                        {o.value.toLocaleString("th-TH")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ทางลัด */}
        <div>
          <p className="mb-2 text-xs font-semibold text-neutral-500">ทางลัด</p>
          <div className="grid grid-cols-3 gap-2">
            {shortcuts.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="flex min-h-[44px] flex-col items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-3 text-center text-xs text-neutral-600 transition-colors hover:border-primary-500/50 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", s.tint)}>
                  <s.icon className="h-4 w-4" />
                </span>
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneMockup({ state, onRetry }: { state: LoadState; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-xs rounded-[1.75rem] border-4 border-neutral-200 bg-neutral-100 p-2 text-neutral-800 shadow-2xl">
      <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-neutral-300" aria-hidden />
      <div className="rounded-2xl bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-neutral-600">กิจกรรมล่าสุด</p>
          {state.status === "error" && <RetryButton onRetry={onRetry} />}
        </div>
        {state.status === "loading" && (
          <ul className="space-y-2" aria-label="กำลังโหลด">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-neutral-100" />
                <span className="h-3 flex-1 animate-pulse rounded bg-neutral-100" />
              </li>
            ))}
          </ul>
        )}
        {state.status === "error" && <ErrorNote text="โหลดกิจกรรมไม่สำเร็จ" />}
        {state.status === "ready" &&
          (state.activity.length === 0 ? (
            <p className="py-4 text-center text-xs text-neutral-400">ยังไม่มีการเติมเหรียญหรือส่งของขวัญ</p>
          ) : (
            <ul className="space-y-2">
              {state.activity.map((a) => (
                <ActivityRow key={`${a.kind}-${a.id}`} item={a} />
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const isTopup = item.kind === "topup";
  const Icon = isTopup ? Coins : Gift;
  const who = getPenName(item.user);
  const detail = isTopup
    ? `เติม ${item.coins.toLocaleString("th-TH")} เหรียญ`
    : `ส่ง${item.gift_name ? ` ${item.gift_name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}` : " เหรียญ"} ให้ ${
        item.recipient ? getPenName(item.recipient) : "-"
      }`;

  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isTopup ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-pink-500/15 text-pink-600 dark:text-pink-400"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-neutral-800">
          <span className="font-semibold">{who}</span> {detail}
        </p>
        <p className="text-[10px] text-neutral-500">
          {formatRelativeThai(item.created_at)}
          {!isTopup && ` · ${item.coins.toLocaleString("th-TH")} เหรียญ`}
          {isTopup && item.amount_thb !== null && ` · ฿${item.amount_thb.toLocaleString("th-TH")}`}
        </p>
      </div>
    </li>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  );
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
    >
      <RefreshCw className="h-3 w-3" /> ลองใหม่
    </button>
  );
}
