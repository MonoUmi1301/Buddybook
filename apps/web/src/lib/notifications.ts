import { Bell, BookOpen, Gift, Headset, MessageCircle, ShieldAlert, Star, UserPlus, type LucideIcon } from "lucide-react";

export type NotificationType =
  | "comment"
  | "review"
  | "reply"
  | "donation"
  | "system"
  | "new_chapter"
  | "new_follower"
  | "support_reply"
  | "moderation";

/** post-moderation — การระงับนิยาย/ผลอุทธรณ์ ปิดไม่ได้ (API กรองทิ้งเองด้วย) */
export const UNMUTABLE_NOTIFICATION_TYPES: NotificationType[] = ["moderation"];

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
  review: "รีวิวนิยายของฉัน",
  reply: "การตอบกลับคอมเมนต์",
  donation: "ของขวัญ / โดเนท",
  new_follower: "ผู้ติดตามใหม่",
  support_reply: "คำตอบจากทีมงาน",
  moderation: "ผลตรวจสอบนิยายจากแอดมิน",
  system: "ประกาศจากระบบ",
};

export const NOTIFICATION_ICON: Record<NotificationType, LucideIcon> = {
  comment: MessageCircle,
  review: Star,
  reply: MessageCircle,
  donation: Gift,
  system: Bell,
  new_chapter: BookOpen,
  new_follower: UserPlus,
  support_reply: Headset,
  moderation: ShieldAlert,
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
