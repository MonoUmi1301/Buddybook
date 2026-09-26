import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { resolveContentReportSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/admin/content-reports/:reportId — { action: "dismiss" | "action", note? }
export async function PATCH(request: Request, { params }: { params: { reportId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const id = requireUuidParam(params.reportId, "report_id");
  if ("error" in id) return id.error;
  const parsed = await parseJsonBody(request, resolveContentReportSchema);
  if ("error" in parsed) return parsed.error;
  return forwardToApi({ method: "PATCH", path: `/admin/content-reports/${id.value}`, token: auth.token, body: parsed.data });
}
