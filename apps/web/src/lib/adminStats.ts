import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";

/** GET /admin/reports/stats — ใช้ทั้งหน้าภาพรวมและตัวเลขงานค้างบนเมนูหลังบ้าน */
export interface AdminStats {
  total_users: number;
  total_novels: number;
  total_chapters: number;
  /** post-moderation — คิวตรวจนิยายที่เผยแพร่แล้ว (แทน pending_review_count เดิม) */
  pending_appeal_count: number;
  unreviewed_novel_count: number;
  suspended_novel_count: number;
  /** เพิ่มภายหลัง (Gift donations) — SUM(donations.fee_amount) สะสม / เดือนนี้ (ปฏิทินไทย) */
  platform_fee_total: number;
  platform_fee_this_month: number;
  platform_fee_percent: number;
  /** เพิ่มภายหลัง — งานที่รอแอดมินจัดการ */
  open_content_reports: number;
  open_gift_reports: number;
  pending_withdrawals: number;
  open_support_tickets: number;
  new_users_7d: number;
  /** แยกผู้ใช้จริง (REAL) กับข้อมูลตัวอย่าง (DEMO) ต่อประเภทข้อมูล */
  demo_split: Record<DemoSplitKey, { real: number; demo: number }>;
}

export type DemoSplitKey = "users" | "novels" | "chapters" | "reviews" | "comments" | "donations";

const zeroSplit = { real: 0, demo: 0 };

export const emptyAdminStats: AdminStats = {
  total_users: 0,
  total_novels: 0,
  total_chapters: 0,
  pending_appeal_count: 0,
  unreviewed_novel_count: 0,
  suspended_novel_count: 0,
  platform_fee_total: 0,
  platform_fee_this_month: 0,
  platform_fee_percent: 10,
  open_content_reports: 0,
  open_gift_reports: 0,
  pending_withdrawals: 0,
  open_support_tickets: 0,
  new_users_7d: 0,
  demo_split: {
    users: zeroSplit,
    novels: zeroSplit,
    chapters: zeroSplit,
    reviews: zeroSplit,
    comments: zeroSplit,
    donations: zeroSplit,
  },
};

export async function getAdminStats(): Promise<AdminStats> {
  const result = await callApi({ method: "GET", path: "/admin/reports/stats", token: await getAccessToken() });
  return !("error" in result) && result.status === 200
    ? { ...emptyAdminStats, ...(result.json as Partial<AdminStats>) }
    : emptyAdminStats;
}
