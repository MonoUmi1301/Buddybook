import { Bell, BookOpen, Gift, Headset, MessageCircle, UserPlus, type LucideIcon } from "lucide-react";

export type NotificationType = "comment" | "reply" | "donation" | "system" | "new_chapter" | "new_follower" | "support_reply";

export interface NotificationItem {
  notification_id: string;
  type: NotificationType;
  content: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  new_chapter: "ตอนใหม่จากนิยายในชั้น",
  comment: "คอมเมนต์ในนิยายของฉัน",
  reply: "การตอบกลับคอมเมนต์",
  donation: "ของขวัญ / โดเนท",
  new_follower: "ผู้ติดตามใหม่",
  support_reply: "คำตอบจากทีมงาน",
  system: "ประกาศจากระบบ",
};

export const NOTIFICATION_ICON: Record<NotificationType, LucideIcon> = {
  comment: MessageCircle,
  reply: MessageCircle,
  donation: Gift,
  system: Bell,
  new_chapter: BookOpen,
  new_follower: UserPlus,
  support_reply: Headset,
};

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
