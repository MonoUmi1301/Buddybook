import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { createReportSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/reports — รายงานเนื้อหาไม่เหมาะสม
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const parsed = await parseJsonBody(request, createReportSchema);
  if ("error" in parsed) return parsed.error;
  return forwardToApi({ method: "POST", path: "/reports", token: auth.token, body: parsed.data });
}
