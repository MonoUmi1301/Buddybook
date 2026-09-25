import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams } from "@/lib/api/validate";
import { continueReadingQuerySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/library/continue-reading?limit= — ประวัติการอ่านล่าสุด ("อ่านต่อ")
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const query = parseSearchParams(request, continueReadingQuerySchema);
  if ("error" in query) return query.error;

  const searchParams = new URLSearchParams();
  if (query.data.limit) searchParams.set("limit", String(query.data.limit));

  return forwardToApi({ method: "GET", path: "/library/continue-reading", token: auth.token, searchParams });
}
