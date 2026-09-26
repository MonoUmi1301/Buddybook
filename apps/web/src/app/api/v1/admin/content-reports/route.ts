import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams } from "@/lib/api/validate";
import { contentReportsQuerySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/admin/content-reports?status=&cursor=
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const query = parseSearchParams(request, contentReportsQuerySchema);
  if ("error" in query) return query.error;

  const searchParams = new URLSearchParams();
  if (query.data.status) searchParams.set("status", query.data.status);
  if (query.data.cursor) searchParams.set("cursor", query.data.cursor);
  return forwardToApi({ method: "GET", path: "/admin/content-reports", token: auth.token, searchParams });
}
