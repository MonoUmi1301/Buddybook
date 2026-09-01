"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, Gift, MessageCircle } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

interface NotificationItem {
  notification_id: string;
  type: "comment" | "reply" | "donation" | "system" | "new_chapter";
  content: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

const tabFilter: Record<"updates" | "comments" | "activity", NotificationItem["type"][]> = {
  // เพิ่มภายหลัง (audit fix) — new_chapter (นิยายที่เก็บไว้ในชั้นหนังสือมีตอนใหม่) เข้าแท็บ "อัปเดต"
  // เช่นเดียวกับ system
  updates: ["system", "new_chapter"],
  comments: ["comment", "reply"],
  activity: ["donation"],
};

const tabs: { key: keyof typeof tabFilter; label: string }[] = [
  { key: "updates", label: "อัปเดต" },
  { key: "comments", label: "คอมเมนต์" },
  { key: "activity", label: "กิจกรรม" },
];

const tabIcon: Record<NotificationItem["type"], typeof Bell> = {
  comment: MessageCircle,
  reply: MessageCircle,
  donation: Gift,
  system: Bell,
  new_chapter: BookOpen,
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
}

/** แผงแจ้งเตือนแบบแท็บ อัปเดต/คอมเมนต์/กิจกรรม — ต่อกับ GET/PATCH /notifications จริง */
export function NotificationPanel({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof typeof tabFilter>("updates");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const isDark = theme === "dark";

  useEffect(() => {
    fetch("/api/v1/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((data) => setNotifications(data.notifications ?? []))
      .catch(() => {});
  }, []);

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
    if (!n.is_read) markRead(n.notification_id);
    setOpen(false);
    if (n.link_url) router.push(n.link_url);
  }

  const items = notifications.filter((n) => tabFilter[activeTab].includes(n.type));
  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="relative" ref={ref}>
      <IconButton
        variant={theme}
        aria-label="การแจ้งเตือน"
        showDot={hasUnread}
        onClick={() => setOpen((v) => !v)}
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
              {t.label}
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
            const Icon = tabIcon[n.type];
            return (
              <li
                key={n.notification_id}
                onClick={() => handleItemClick(n)}
                className={cn(
                  "flex cursor-pointer gap-3 px-4 py-3 text-sm transition-colors",
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
                <div className="min-w-0">
                  <p className={cn(!n.is_read && "font-medium", isDark ? "text-zinc-200" : "text-neutral-800")}>
                    {n.content}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="ml-auto mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
