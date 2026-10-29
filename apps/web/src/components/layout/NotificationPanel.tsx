"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { NOTIFICATION_ICON, timeAgo, type NotificationItem } from "@/lib/notifications";

// เดิม 30 วิ — รวมกับรอบ cron เผยแพร่ตอนตั้งเวลา ผู้ใช้รู้สึกว่าต้องรีเฟรชเอง ลดเหลือ 10 วิ (เรียกเฉพาะตอนแท็บเปิดอยู่)
const NOTIFICATION_POLL_MS = 10_000;

const tabFilter: Record<"updates" | "comments" | "activity", NotificationItem["type"][]> = {
  // เพิ่มภายหลัง (audit fix) — new_chapter (นิยายที่เก็บไว้ในชั้นหนังสือมีตอนใหม่) เข้าแท็บ "อัปเดต"
  // เช่นเดียวกับ system; gap 3.2 — คำตอบจากทีมงานแจ้งปัญหา (support_reply) ก็อยู่แท็บนี้
  updates: ["system", "new_chapter", "support_reply", "moderation"],
  comments: ["comment", "review", "reply"],
  // เพิ่มภายหลัง (ติดตามนักเขียน) — มีผู้ติดตามใหม่
  activity: ["donation", "new_follower"],
};

const tabs: { key: keyof typeof tabFilter; label: string }[] = [
  { key: "updates", label: "อัปเดต" },
  { key: "comments", label: "คอมเมนต์" },
  { key: "activity", label: "กิจกรรม" },
];

/** แผงแจ้งเตือนแบบแท็บ อัปเดต/คอมเมนต์/กิจกรรม — ต่อกับ GET/PATCH /notifications จริง */
export function NotificationPanel({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof typeof tabFilter>("updates");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const isDark = theme === "dark";

  // เดิมดึงครั้งเดียวตอน mount — แจ้งเตือนใหม่ (เช่นตอนที่ตั้งเวลาไว้เพิ่งเผยแพร่) ต้องรีเฟรชหน้าถึงจะเห็น
  // ตอนนี้ดึงซ้ำทุก 30 วิขณะแท็บเปิดอยู่ + ทันทีที่กลับมาที่แท็บ + ตอนกดเปิดกระดิ่ง
  // (เลือก polling แทน WebSocket/SSE เพราะ API เป็น Express ธรรมดาผ่าน proxy ของ Next — ง่ายและพอสำหรับแจ้งเตือน)
  // จำ id ที่เคยเห็นแล้ว — แจ้งเตือนใหม่ที่เพิ่งเข้ามาระหว่างเปิดหน้าอยู่จะเด้ง toast มุมจอด้วย (ไม่ใช่แค่จุดบนกระดิ่ง)
  // รอบแรกตอนเปิดหน้าไม่เด้ง (ของที่ค้างอยู่แล้วดูได้จากกระดิ่ง)
  const seenIdsRef = useRef<Set<string> | null>(null);
  const refresh = useCallback(() => {
    fetch("/api/v1/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const list: NotificationItem[] = data.notifications ?? [];
        const seen = seenIdsRef.current;
        if (seen) {
          const fresh = list.filter((n) => !n.is_read && !seen.has(n.notification_id));
          // เด้งไม่เกิน 3 อันต่อรอบ กันจอรก
          fresh.slice(0, 3).forEach((n) => toast(n.content));
          // มีแจ้งเตือนใหม่ (เช่นตอนที่ตั้งเวลาไว้เพิ่งเผยแพร่) = ข้อมูลบนหน้าอาจเปลี่ยน — ดึงข้อมูลหน้าปัจจุบันใหม่
          // (router.refresh โหลด server component ใหม่โดยไม่ล้าง state ของฟอร์มที่กรอกค้างอยู่)
          if (fresh.length > 0) router.refresh();
        }
        seenIdsRef.current = new Set([...(seen ?? []), ...list.map((n) => n.notification_id)]);
        setNotifications(list);
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, NOTIFICATION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n)));
    fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
  }

  // เพิ่มภายหลัง (audit fix) — คลิกแถบแจ้งเตือนแล้วต้องพาไปหน้าที่เกี่ยวข้องเลย (เช่นตอนใหม่ที่อัปเดต)
  // ไม่ใช่แค่ทำเครื่องหมายอ่านแล้วเฉย ๆ เหมือนเดิม
  function handleItemClick(n: NotificationItem) {
    if (!n.is_read) markRead(n.notification_id).catch(console.error);
    setOpen(false);
    if (n.link_url) router.push(n.link_url);
  }

  const items = notifications.filter((n) => tabFilter[activeTab].includes(n.type));
  const hasUnread = notifications.some((n) => !n.is_read);
  // จุดแดงบนแต่ละแท็บ — บอกว่าแจ้งเตือนที่ยังไม่อ่านอยู่หมวดไหน (อัปเดต/คอมเมนต์/กิจกรรม)
  const unreadByTab: Record<keyof typeof tabFilter, number> = {
    updates: notifications.filter((n) => !n.is_read && tabFilter.updates.includes(n.type)).length,
    comments: notifications.filter((n) => !n.is_read && tabFilter.comments.includes(n.type)).length,
    activity: notifications.filter((n) => !n.is_read && tabFilter.activity.includes(n.type)).length,
  };

  return (
    <div className="relative" ref={ref}>
      <IconButton
        variant={theme}
        aria-label="การแจ้งเตือน"
        showDot={hasUnread}
        onClick={() => {
          if (!open) refresh();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell className="h-5 w-5" />
      </IconButton>

      <div
        role="menu"
        className={cn(
          "absolute right-0 top-12 z-50 w-80 origin-top-right overflow-hidden rounded-card border shadow-xl transition-all duration-150",
          isDark ? "border-surface-border bg-surface-raised" : "border-neutral-200 bg-white",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        )}
      >
        <div className={cn("flex border-b", isDark ? "border-surface-border" : "border-neutral-200")}>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex-1 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab === t.key
                  ? "border-primary-500 text-primary-500"
                  : cn("border-transparent", isDark ? "text-zinc-400 hover:text-zinc-200" : "text-neutral-500 hover:text-neutral-700")
              )}
            >
              <span className="relative inline-block">
                {t.label}
                {unreadByTab[t.key] > 0 && (
                  <span
                    aria-label={`มีแจ้งเตือนใหม่ ${unreadByTab[t.key]} รายการ`}
                    className="absolute -right-2.5 -top-1 h-2 w-2 rounded-full bg-red-500"
                  />
                )}
              </span>
            </button>
          ))}
        </div>

        <ul className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 && (
            <li>
              <EmptyState title="ยังไม่มีการแจ้งเตือน" size="sm" className="py-6" />
            </li>
          )}
          {items.map((n) => {
            const Icon = NOTIFICATION_ICON[n.type];
            return (
              <li key={n.notification_id}>
                <button
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={cn(
                    "flex w-full cursor-pointer gap-3 px-4 py-3 text-left text-sm transition-colors",
                    isDark ? "hover:bg-white/5" : "hover:bg-neutral-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      n.type === "donation" ? "bg-amber-500/15 text-amber-500" : "bg-primary-500/15 text-primary-500"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {/* ใน <button> ใช้ได้แค่ phrasing content — span แบบ block แทน div/p */}
                  <span className="block min-w-0">
                    <span className={cn("block", !n.is_read && "font-medium", isDark ? "text-zinc-200" : "text-neutral-800")}>
                      {n.content}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="ml-auto mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
                </button>
              </li>
            );
          })}
        </ul>
        {/* gap 3.3 — หน้าแจ้งเตือนเต็ม (แบ่งหน้า/กรอง/ตั้งค่า) */}
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className={cn(
            "block border-t px-4 py-2.5 text-center text-sm font-medium text-primary-500 hover:underline",
            isDark ? "border-surface-border" : "border-neutral-200"
          )}
        >
          ดูการแจ้งเตือนทั้งหมด
        </Link>
      </div>
    </div>
  );
}
