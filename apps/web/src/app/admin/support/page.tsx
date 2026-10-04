import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { SupportQueue } from "@/components/admin/SupportQueue";
import type { SupportTicketSummary } from "@/lib/support";

// gap 3.2 — GET /admin/support/tickets (ค่าเริ่มต้น = เรื่องที่ยังเปิดอยู่)
export default async function AdminSupportPage() {
  const result = await callApi({ method: "GET", path: "/admin/support/tickets", token: getAccessToken() });
  const tickets =
    !("error" in result) && result.status === 200 ? (result.json as { tickets: SupportTicketSummary[] }).tickets : [];
  return <SupportQueue initial={tickets} />;
}
