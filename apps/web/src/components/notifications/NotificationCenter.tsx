"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  NOTIFICATION_ICON,
  NOTIFICATION_TYPE_LABEL,
  timeAgo,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications";

interface Page {
  notifications: NotificationItem[];
  total: number;
  page: number;
  pageSize: number;
  unread_count: number;
  muted_types: NotificationType[];
}

const PAGE_SIZE = 20;
const FILTERS: { value: NotificationType | "all"; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "new_chapter", label: "ตอนใหม่" },
  { value: "comment", label: "คอมเมนต์" },
  { value: "reply", label: "ตอบกลับ" },
  { value: "donation", label: "ของขวัญ" },
  { value: "new_follower", label: "ผู้ติดตาม" },
  { value: "support_reply", label: "ทีมงาน" },
  { value: "system", label: "ระบบ" },
];

/**
 * gap 3.3 — หน้าแจ้งเตือนเต็ม: กรองประเภท/ยังไม่อ่าน, แบ่งหน้า, อ่านทั้งหมด, ปิดการแจ้งเตือนรายประเภท
 * desktop: รายการ + แผงตั้งค่าด้านขวา / iPad-มือถือ: แผงตั้งค่าพับเก็บ เปิดด้วยปุ่ม "ตั้งค่า"
 */
export function NotificationCenter({ initial }: { initial: Page }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<NotificationType | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [muted, setMuted] = useState<NotificationType[]>(initial.muted_types);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (filter !== "all") qs.set("type", filter);
      if (unreadOnly) qs.set("unread_only", "true");
      const res = await fetch(`/api/v1/notifications?${qs}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filter, unreadOnly, page]);

  useEffect(() => {
    // หน้าแรกแบบไม่กรองมาจาก server แล้ว ไม่ต้องโหลดซ้ำ
    if (filter === "all" && !unreadOnly && page === 1 && data === initial) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดใหม่เมื่อเงื่อนไขเปลี่ยนเท่านั้น
  }, [filter, unreadOnly, page]);

  async function open(n: NotificationItem) {
    if (!n.is_read) {
      fetch(`/api/v1/notifications/${n.notification_id}/read`, { method: "PATCH" }).catch(() => {});
      setData((d) => ({
        ...d,
        unread_count: Math.max(0, d.unread_count - 1),
        notifications: d.notifications.map((x) => (x.notification_id === n.notification_id ? { ...x, is_read: true } : x)),
      }));
    }
    if (n.link_url) router.push(n.link_url);
  }

  async function markAll() {
    await fetch("/api/v1/notifications/read-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filter === "all" ? {} : { type: filter }),
    });
    await load();
    router.refresh();
  }

  async function toggleMute(type: NotificationType) {
    const next = muted.includes(type) ? muted.filter((t) => t !== type) : [...muted, type];
    setMuted(next);
    setSavingPrefs(true);
    try {
      await fetch("/api/v1/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted_types: next }),
      });
      await load();
    } finally {
      setSavingPrefs(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-neutral-600">
            ยังไม่อ่าน <strong className="tabular-nums text-neutral-900">{data.unread_count.toLocaleString("th-TH")}</strong> รายการ
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={markAll} disabled={data.unread_count === 0}>
              <CheckCheck className="h-4 w-4" /> อ่านทั้งหมด
            </Button>
            <Button size="sm" variant="outline" className="lg:hidden" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>
              <Settings2 className="h-4 w-4" /> ตั้งค่า
            </Button>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setFilter(f.value);
                setPage(1);
              }}
              className={cn(
                "min-h-[36px] shrink-0 rounded-pill px-3.5 text-sm",
                filter === f.value ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600 hover:text-neutral-900"
              )}
            >
              {f.label}
            </button>
          ))}
          <label className="ml-1 flex shrink-0 items-center gap-1.5 text-sm text-neutral-600">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} className="h-4 w-4 rounded border-neutral-300" />
            เฉพาะที่ยังไม่อ่าน
          </label>
        </div>

        <div className={cn("rounded-card border border-neutral-200", loading && "opacity-60")}>
          {data.notifications.length === 0 ? (
            <p className="px-4 py-14 text-center text-sm text-neutral-400">
              {filter !== "all" && muted.includes(filter) ? "ประเภทนี้ถูกปิดการแจ้งเตือนไว้" : "ไม่มีการแจ้งเตือน"}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.notifications.map((n) => {
                const Icon = NOTIFICATION_ICON[n.type];
                return (
                  <li key={n.notification_id}>
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className={cn("flex w-full gap-3 px-4 py-3.5 text-left hover:bg-neutral-50", !n.is_read && "bg-primary-50/40")}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm text-neutral-800", !n.is_read && "font-medium")}>{n.content}</span>
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          {NOTIFICATION_TYPE_LABEL[n.type]} · {timeAgo(n.created_at)}
                        </span>
                      </span>
                      {!n.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500">
                          <span className="sr-only">ยังไม่อ่าน</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {totalPages > 1 && (
          <nav aria-label="หน้า" className="mt-4 flex items-center justify-center gap-3 text-sm">
            <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              ก่อนหน้า
            </Button>
            <span className="tabular-nums text-neutral-600">
              {page} / {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
              ถัดไป
            </Button>
          </nav>
        )}
      </div>

      <aside className={cn("rounded-card border border-neutral-200 p-4 lg:block lg:self-start", !showSettings && "max-lg:hidden")}>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <BellOff className="h-4 w-4" /> ตั้งค่าการแจ้งเตือน
          {savingPrefs && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />}
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-neutral-500">ปิดประเภทที่ไม่ต้องการเห็น (เปิดกลับได้ทุกเมื่อ)</p>
        <ul className="space-y-2">
          {(Object.keys(NOTIFICATION_TYPE_LABEL) as NotificationType[]).map((t) => {
            const on = !muted.includes(t);
            return (
              <li key={t}>
                <label className="flex min-h-[36px] cursor-pointer items-center justify-between gap-3 text-sm text-neutral-700">
                  {NOTIFICATION_TYPE_LABEL[t]}
                  <input
                    type="checkbox"
                    role="switch"
                    aria-checked={on}
                    checked={on}
                    onChange={() => toggleMute(t)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300",
                      on ? "bg-primary-500" : "bg-neutral-300"
                    )}
                  >
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-neutral-500">
          มีปัญหาการใช้งาน?{" "}
          <Link href="/support" className="font-medium text-primary-600 hover:underline">
            แจ้งทีมงาน
          </Link>
        </p>
      </aside>
    </div>
  );
}
