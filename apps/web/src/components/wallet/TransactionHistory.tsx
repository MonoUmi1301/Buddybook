"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Gift,
  History,
  Landmark,
  Loader2,
  PlusCircle,
  RotateCcw,
} from "lucide-react";

/** ค่าเดียวกับ enum WalletTxType ใน apps/api/prisma/schema.prisma */
type WalletTxType =
  | "topup"
  | "donation_sent"
  | "donation_received"
  | "chapter_purchase"
  | "chapter_sale"
  | "withdrawal"
  | "withdrawal_refund";

interface WalletTransaction {
  transaction_id: string;
  type: WalletTxType;
  amount: string | number;
  balance_after: string | number;
  created_at: string;
}

// amount ใน DB เก็บเป็นบวกเสมอ — ทิศทาง (+/−) ดูจากประเภทรายการ
const TX_META: Record<WalletTxType, { label: string; outgoing: boolean; Icon: typeof Gift }> = {
  topup: { label: "เติม coin", outgoing: false, Icon: PlusCircle },
  donation_sent: { label: "ส่งของขวัญ / โดเนท", outgoing: true, Icon: Gift },
  donation_received: { label: "ได้รับของขวัญ / โดเนท", outgoing: false, Icon: Gift },
  chapter_purchase: { label: "ปลดล็อกตอน", outgoing: true, Icon: BookOpen },
  chapter_sale: { label: "รายได้จากตอนติดเหรียญ", outgoing: false, Icon: BookOpen },
  withdrawal: { label: "ถอนรายได้", outgoing: true, Icon: Landmark },
  withdrawal_refund: { label: "คืน coin จากการถอนที่ถูกปฏิเสธ", outgoing: false, Icon: RotateCcw },
};

type Filter = "all" | "in" | "out";
const PAGE_SIZE = 10;

const dateFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** ประวัติการซื้อ/ใช้ coin — อ่านจาก GET /wallet/transactions (ข้อมูลชุดเดียวกับที่ใช้คำนวณยอดคงเหลือ)
 *  refreshKey เปลี่ยน (เช่นยอด coin เปลี่ยนหลังเติมเงิน/ถอน) → ดึงใหม่ให้รายการล่าสุดขึ้นทันที
 *  id="history" ให้เมนู "ประวัติการซื้อ" ลิงก์มาที่ /wallet#history ได้ตรงส่วนนี้ */
export function TransactionHistory({ refreshKey }: { refreshKey?: unknown }) {
  const [items, setItems] = useState<WalletTransaction[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetch("/api/v1/wallet/transactions", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ transactions: WalletTransaction[] }>) : Promise.reject()))
      .then((json) => {
        if (!cancelled) setItems(json.transactions ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filtered = (items ?? []).filter((tx) => {
    const meta = TX_META[tx.type];
    if (!meta || filter === "all") return true;
    return filter === "out" ? meta.outgoing : !meta.outgoing;
  });

  return (
    <section id="history" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-3">
          <History className="h-8 w-8 text-primary-500" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">ประวัติการซื้อ</h2>
            <p className="text-sm text-neutral-500">รายการเติม ใช้ และรับ coin ทั้งหมดของบัญชีนี้</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-full bg-neutral-100 p-1 text-sm" role="tablist">
          {(
            [
              ["all", "ทั้งหมด"],
              ["in", "เข้า"],
              ["out", "ออก"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => {
                setFilter(value);
                setVisible(PAGE_SIZE);
              }}
              className={`rounded-full px-3 py-1 font-medium transition ${
                filter === value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {items === null && !error && (
        <div className="flex items-center justify-center gap-2 py-10 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" /> กำลังโหลดประวัติ...
        </div>
      )}

      {error && (
        <p className="py-10 text-center text-sm text-red-600">โหลดประวัติไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</p>
      )}

      {items !== null && !error && filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-neutral-500">
          {filter === "all" ? "ยังไม่มีรายการ — เติม coin ครั้งแรกแล้วรายการจะขึ้นที่นี่" : "ไม่มีรายการในหมวดนี้"}
        </p>
      )}

      {filtered.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {filtered.slice(0, visible).map((tx) => {
            const meta = TX_META[tx.type] ?? { label: tx.type, outgoing: false, Icon: History };
            const amount = Number(tx.amount);
            const DirIcon = meta.outgoing ? ArrowUpRight : ArrowDownLeft;
            return (
              <li key={tx.transaction_id} className="flex items-center gap-3 py-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    meta.outgoing ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  <meta.Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900">{meta.label}</p>
                  <p className="text-xs text-neutral-500">{dateFormat.format(new Date(tx.created_at))}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`flex items-center justify-end gap-0.5 font-semibold ${
                      meta.outgoing ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    <DirIcon className="h-4 w-4" aria-hidden />
                    {meta.outgoing ? "−" : "+"}
                    {amount.toLocaleString()} coin
                  </p>
                  <p className="text-xs text-neutral-500">คงเหลือ {Number(tx.balance_after).toLocaleString()}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mt-4 w-full rounded-button border border-neutral-200 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          ดูเพิ่ม ({filtered.length - visible} รายการ)
        </button>
      )}
    </section>
  );
}
