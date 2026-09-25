"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { LetterCard } from "@/components/gifts/LetterCard";
import { toast } from "@/components/ui/Toaster";
import { formatThaiDate } from "@/lib/format";
import { giftLabel, type GiftSummary, type GiftUser } from "@/lib/gifts";
import type { CardTemplate } from "@/lib/donate-assets";

export interface GiftReportRow {
  donation_id: string;
  gift: GiftSummary | null;
  quantity: number;
  amount: number;
  card_template: CardTemplate | null;
  message: string | null;
  signature_name: string | null;
  is_anonymous: boolean;
  is_public: boolean;
  /** แอดมินเห็นผู้ส่งจริงเสมอ แม้ผู้ส่งเลือกไม่ระบุตัวตน */
  sender: GiftUser;
  recipient: GiftUser;
  novel: { novel_id: string; title: string } | null;
  reported_at: string;
  report_reason: string | null;
  hidden_at: string | null;
  created_at: string;
}

function displayName(u: GiftUser) {
  return u.pen_name || u.username;
}

/**
 * เพิ่มภายหลัง (Gift donations) — การ์ดที่นักเขียนรายงาน (GET/PATCH /admin/gift-reports)
 * ปล่อยผ่าน = ข้อความไม่ผิด (กลับไปแสดงสาธารณะได้ถ้าผู้ส่งเปิดไว้), ซ่อน = ซ่อนจากทุกที่
 */
export function GiftReports({ initialItems, initialCursor }: { initialItems: GiftReportRow[]; initialCursor: string | null }) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function resolve(row: GiftReportRow, action: "dismiss" | "hide") {
    setBusyId(row.donation_id);
    const res = await fetch(`/api/v1/admin/gift-reports/${row.donation_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setItems((xs) => xs.filter((x) => x.donation_id !== row.donation_id));
      toast(action === "hide" ? "ซ่อนการ์ดแล้ว" : "ปล่อยผ่านแล้ว");
    } else {
      toast("ทำรายการไม่สำเร็จ");
    }
    setBusyId(null);
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const res = await fetch(`/api/v1/admin/gift-reports?cursor=${cursor}`, { cache: "no-store" });
    if (res.ok) {
      const page = (await res.json()) as { items: GiftReportRow[]; next_cursor: string | null };
      setItems((xs) => [...xs, ...page.items]);
      setCursor(page.next_cursor);
    }
    setLoadingMore(false);
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900">การ์ดที่ถูกรายงาน</h2>
      <p className="mb-4 text-xs text-neutral-500">การ์ดที่รอตรวจจะไม่แสดงต่อสาธารณะจนกว่าจะตัดสิน</p>

      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-neutral-300 px-6 py-12 text-center text-sm text-neutral-500">
          ไม่มีการ์ดที่รอตรวจ
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((row) => (
            <li key={row.donation_id} className="rounded-card border border-neutral-200 bg-white p-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <LetterCard
                  template={row.card_template ?? "stamp"}
                  size="mini"
                  recipientName={displayName(row.recipient)}
                  message={row.message ?? ""}
                  signature={row.is_anonymous ? "นักอ่านนิรนาม" : row.signature_name || displayName(row.sender)}
                  placeholder="(ไม่มีข้อความ)"
                />
                <dl className="space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-neutral-500">เหตุผล</dt>
                    <dd className="min-w-0 break-words text-neutral-900">{row.report_reason || "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-neutral-500">ผู้ส่ง</dt>
                    <dd className="min-w-0">
                      <Link href={`/profile/${row.sender.user_id}`} className="text-primary-600 hover:underline">
                        {displayName(row.sender)}
                      </Link>
                      <span className="text-neutral-500"> @{row.sender.username}</span>
                      {row.is_anonymous && <span className="text-xs text-neutral-500"> (ส่งแบบไม่ระบุตัวตน)</span>}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-neutral-500">ผู้รับ</dt>
                    <dd className="min-w-0">{displayName(row.recipient)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-neutral-500">ของขวัญ</dt>
                    <dd className="min-w-0">
                      {giftLabel(row)}
                      {row.novel && <span className="text-neutral-500"> · {row.novel.title}</span>}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-neutral-500">วันที่</dt>
                    <dd>
                      ส่ง {formatThaiDate(row.created_at)} · รายงาน {formatThaiDate(row.reported_at)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-neutral-500">การมองเห็น</dt>
                    <dd>{row.is_public ? "ผู้ส่งเปิดเป็นสาธารณะ" : "ส่วนตัว"}{row.hidden_at && " · นักเขียนซ่อนไว้แล้ว"}</dd>
                  </div>
                </dl>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={busyId === row.donation_id}
                  onClick={() => resolve(row, "dismiss")}
                  className="min-h-[44px] rounded-pill border border-neutral-300 px-5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  ปล่อยผ่าน
                </button>
                <button
                  type="button"
                  disabled={busyId === row.donation_id}
                  onClick={() => resolve(row, "hide")}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-pill bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busyId === row.donation_id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  ซ่อนการ์ด
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="min-h-[44px] rounded-pill border border-neutral-300 px-6 text-sm disabled:opacity-50"
          >
            โหลดเพิ่ม
          </button>
        </div>
      )}
    </div>
  );
}
