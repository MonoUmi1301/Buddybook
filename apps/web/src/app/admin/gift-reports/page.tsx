import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { GiftReports, type GiftReportRow } from "@/components/admin/GiftReports";

// เพิ่มภายหลัง (Gift donations) — GET /admin/gift-reports (การ์ดที่ถูกรายงานและยังไม่ได้ตัดสิน)
export default async function AdminGiftReportsPage() {
  const result = await callApi({ method: "GET", path: "/admin/gift-reports", token: getAccessToken() });
  const page =
    !("error" in result) && result.status === 200
      ? (result.json as { items: GiftReportRow[]; next_cursor: string | null })
      : { items: [], next_cursor: null };

  return <GiftReports initialItems={page.items} initialCursor={page.next_cursor} />;
}
