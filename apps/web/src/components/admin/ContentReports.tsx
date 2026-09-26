"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/Toaster";
import { formatThaiDate } from "@/lib/format";

type ReportStatus = "open" | "dismissed" | "actioned";
type TargetType = "novel" | "chapter" | "comment" | "review" | "user";

export interface ContentReportRow {
  report_id: string;
  target_type: TargetType;
  target_id: string;
  reason: "spam" | "harassment" | "inappropriate" | "copyright" | "other";
  details: string | null;
  status: ReportStatus;
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter: { user_id: string; username: string };
  /** null = เนื้อหาถูกลบไปแล้ว */
  target: { preview: string; link_url: string | null; owner_id: string } | null;
  open_report_count: number;
}

const TARGET_LABEL: Record<TargetType, string> = {
  novel: "นิยาย",
  chapter: "ตอน",
  comment: "คอมเมนต์",
  review: "รีวิว",
  user: "ผู้ใช้",
};

const REASON_LABEL: Record<ContentReportRow["reason"], string> = {
  spam: "สแปม / โฆษณา",
  harassment: "คุกคาม",
  inappropriate: "ไม่เหมาะสม",
  copyright: "ละเมิดลิขสิทธิ์",
  other: "อื่น ๆ",
};

/** สิ่งที่ปุ่ม "จัดการ" ทำกับเป้าหมายแต่ละชนิด (ดู apps/api/src/modules/reports/reports.service.ts) */
const ACTION_LABEL: Record<TargetType, string> = {
  novel: "ตั้งเป็นส่วนตัว",
  chapter: "ซ่อนตอน",
  comment: "ลบคอมเมนต์",
  review: "ลบรีวิว",
  user: "ระงับบัญชี",
};

const STATUS_TABS: { value: ReportStatus; label: string }[] = [
  { value: "open", label: "รอตรวจ" },
  { value: "actioned", label: "จัดการแล้ว" },
  { value: "dismissed", label: "ปล่อยผ่าน" },
];

interface Page {
  reports: ContentReportRow[];
  next_cursor: string | null;
}

/** เพิ่มภายหลัง (รายงานเนื้อหา) — GET/PATCH /admin/content-reports */
export function ContentReports({ initial }: { initial: Page }) {
  const [status, setStatus] = useState<ReportStatus>("open");
  const [items, setItems] = useState(initial.reports);
  const [cursor, setCursor] = useState(initial.next_cursor);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function fetchPage(nextStatus: ReportStatus, nextCursor?: string) {
    const params = new URLSearchParams({ status: nextStatus });
    if (nextCursor) params.set("cursor", nextCursor);
    const res = await fetch(`/api/v1/admin/content-reports?${params}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as Page) : null;
  }

  async function switchTab(next: ReportStatus) {
    setStatus(next);
    setLoading(true);
    const page = await fetchPage(next);
    setItems(page?.reports ?? []);
    setCursor(page?.next_cursor ?? null);
    setLoading(false);
  }

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    const page = await fetchPage(status, cursor);
    if (page) {
      setItems((xs) => [...xs, ...page.reports]);
      setCursor(page.next_cursor);
    }
    setLoading(false);
  }

  async function resolve(row: ContentReportRow, action: "dismiss" | "action") {
    if (action === "action" && !window.confirm(`ยืนยัน "${ACTION_LABEL[row.target_type]}"?`)) return;
    setBusyId(row.report_id);
    const res = await fetch(`/api/v1/admin/content-reports/${row.report_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      // รายงานอื่นที่ชี้เป้าหมายเดียวกันถูกปิดไปด้วย
      setItems((xs) => xs.filter((x) => !(x.target_type === row.target_type && x.target_id === row.target_id)));
      toast(action === "action" ? "จัดการเนื้อหาแล้ว" : "ปล่อยผ่านแล้ว");
    } else {
      toast("ทำรายการไม่สำเร็จ");
    }
    setBusyId(null);
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900">รายงานเนื้อหา</h2>
      <p className="mb-4 text-xs text-neutral-500">รายงานจากผู้ใช้ — การจัดการจะปิดทุกรายงานของเนื้อหาเดียวกันและแจ้งผลผู้รายงาน</p>

      <div className="mb-4 flex gap-2" role="tablist">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={status === t.value}
            onClick={() => switchTab(t.value)}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm",
              status === t.value ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items.length === 0 && !loading ? (
        <p className="rounded-card border border-dashed border-neutral-300 px-6 py-12 text-center text-sm text-neutral-500">
          ไม่มีรายงาน
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.report_id} className="rounded-card border border-neutral-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-pill bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                  {TARGET_LABEL[row.target_type]}
                </span>
                <span className="rounded-pill bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600">
                  {REASON_LABEL[row.reason]}
                </span>
                {row.open_report_count > 1 && (
                  <span className="text-xs text-neutral-500">ถูกรายงาน {row.open_report_count} ครั้ง</span>
                )}
                <span className="ml-auto text-xs text-neutral-400">{formatThaiDate(row.created_at)}</span>
              </div>

              <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2">
                {row.target ? (
                  <>
                    <p className="whitespace-pre-line break-words text-neutral-800">{row.target.preview}</p>
                    {row.target.link_url && (
                      <Link href={row.target.link_url} target="_blank" className="mt-1 inline-block text-xs text-primary-600 hover:underline">
                        เปิดดู
                      </Link>
                    )}
                  </>
                ) : (
                  <p className="text-neutral-400">(เนื้อหาถูกลบไปแล้ว)</p>
                )}
              </div>

              {row.details && <p className="mt-2 break-words text-neutral-600">“{row.details}”</p>}
              <p className="mt-2 text-xs text-neutral-500">
                รายงานโดย{" "}
                <Link href={`/profile/${row.reporter.user_id}`} className="text-primary-600 hover:underline">
                  @{row.reporter.username}
                </Link>
                {row.admin_note && ` · หมายเหตุ: ${row.admin_note}`}
              </p>

              {row.status === "open" && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.report_id}
                    onClick={() => resolve(row, "dismiss")}
                    className="min-h-[44px] rounded-pill border border-neutral-300 px-5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    ปล่อยผ่าน
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.report_id || !row.target}
                    onClick={() => resolve(row, "action")}
                    className="min-h-[44px] rounded-pill bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {ACTION_LABEL[row.target_type]}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {(loading || cursor) && (
        <div className="mt-4 flex justify-center">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          ) : (
            <button type="button" onClick={loadMore} className="text-sm text-primary-600 hover:underline">
              โหลดเพิ่ม
            </button>
          )}
        </div>
      )}
    </div>
  );
}
