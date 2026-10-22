/** post-moderation — เคสระงับนิยายที่ยังมีผลอยู่ (GET /novels/:id และ /novels/search?mine=true ส่งให้เจ้าของเห็น) */
export interface ModerationCase {
  case_id: string;
  status: "suspended" | "appeal_pending" | "upheld" | "reinstated";
  reason: string;
  created_at: string;
  appeal_message: string | null;
  appealed_at: string | null;
  appeal_count: number;
  resolution_note: string | null;
  resolved_at: string | null;
}

export const MODERATION_STATUS_LABEL: Record<ModerationCase["status"], string> = {
  suspended: "ถูกระงับ",
  appeal_pending: "รอพิจารณาอุทธรณ์",
  upheld: "อุทธรณ์ไม่ผ่าน",
  reinstated: "คืนสถานะแล้ว",
};

/** ยื่นอุทธรณ์ได้เมื่อยังถูกระงับและไม่มีคำอุทธรณ์ค้างอยู่ */
export function canAppeal(c: ModerationCase | null | undefined): boolean {
  return Boolean(c && (c.status === "suspended" || c.status === "upheld"));
}
