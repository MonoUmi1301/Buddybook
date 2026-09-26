import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { ContentReports, type ContentReportRow } from "@/components/admin/ContentReports";

// เพิ่มภายหลัง (รายงานเนื้อหา) — GET /admin/content-reports?status=open
export default async function AdminContentReportsPage() {
  const result = await callApi({ method: "GET", path: "/admin/content-reports", token: getAccessToken() });
  const page =
    !("error" in result) && result.status === 200
      ? (result.json as { reports: ContentReportRow[]; next_cursor: string | null })
      : { reports: [], next_cursor: null };

  return <ContentReports initial={page} />;
}
