"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { SupportStatusBadge } from "@/components/support/StatusBadge";
import { SUPPORT_CATEGORY_LABEL, type SupportStatus, type SupportTicketSummary } from "@/lib/support";
import { cn } from "@/lib/cn";

const TABS: { value: SupportStatus | "active"; label: string }[] = [
  { value: "active", label: "ต้องดำเนินการ" },
  { value: "resolved", label: "แก้ไขแล้ว" },
  { value: "closed", label: "ปิดแล้ว" },
];

/** gap 3.2 — คิวเรื่องแจ้งปัญหาของทีมงาน เรื่องที่ค้างนานสุดขึ้นก่อน */
export function SupportQueue({ initial }: { initial: SupportTicketSummary[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("active");
  const [tickets, setTickets] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function load(next: (typeof TABS)[number]["value"]) {
    setTab(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/support/tickets${next === "active" ? "" : `?status=${next}`}`);
      if (res.ok) setTickets((await res.json()).tickets);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => load(t.value)}
            className={cn(
              "min-h-[36px] shrink-0 rounded-pill px-3.5 text-sm",
              tab === t.value ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600 hover:text-neutral-900"
            )}
          >
            {t.label}
          </button>
        ))}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
      </div>
      {tickets.length === 0 ? (
        <p className="rounded-card border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-400">ไม่มีเรื่องในคิวนี้</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-card border border-neutral-200">
          {tickets.map((t) => (
            <li key={t.ticket_id}>
              <Link href={`/support/${t.ticket_id}`} className="flex flex-col gap-1 p-3.5 hover:bg-neutral-50 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
                <div className="flex shrink-0 items-center gap-2">
                  <SupportStatusBadge status={t.status} />
                  {t.awaiting_staff && t.status !== "closed" && (
                    <span className="rounded-pill bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white">รอตอบ</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-neutral-900">{t.subject}</p>
                  <p className="text-xs text-neutral-500">
                    {SUPPORT_CATEGORY_LABEL[t.category]} · {t.user?.username} · {t.message_count} ข้อความ
                  </p>
                </div>
                <p className="shrink-0 text-xs text-neutral-400">
                  อัปเดต {new Date(t.updated_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
