export type SupportCategory = "account" | "payment" | "bug" | "content" | "other";
export type SupportStatus = "open" | "in_progress" | "resolved" | "closed";

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  account: "บัญชีและการเข้าสู่ระบบ",
  payment: "เติมเงิน / เหรียญ / ถอนเงิน",
  bug: "เว็บใช้งานผิดปกติ",
  content: "นิยายและเนื้อหา",
  other: "อื่น ๆ",
};

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "รอดำเนินการ",
  in_progress: "กำลังดำเนินการ",
  resolved: "แก้ไขแล้ว",
  closed: "ปิดเรื่องแล้ว",
};

/** สถานะใช้ไอคอน/ข้อความคู่สีเสมอ (ไม่สื่อด้วยสีอย่างเดียว) */
export const SUPPORT_STATUS_CLASS: Record<SupportStatus, string> = {
  open: "bg-amber-50 text-amber-800 border-amber-200",
  in_progress: "bg-sky-50 text-sky-800 border-sky-200",
  resolved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  closed: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

export interface SupportTicketSummary {
  ticket_id: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  message_count: number;
  awaiting_user?: boolean;
  awaiting_staff?: boolean;
  user?: { user_id: string; username: string; email?: string };
}

export interface SupportMessage {
  message_id: string;
  is_staff: boolean;
  body: string;
  attachment_url: string | null;
  created_at: string;
  author: { user_id: string; username: string } | null;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  user: { user_id: string; username: string; email?: string };
  messages: SupportMessage[];
}
