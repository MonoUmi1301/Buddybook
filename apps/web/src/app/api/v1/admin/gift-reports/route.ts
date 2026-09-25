import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams } from "@/lib/api/validate";
import { cursorQuerySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/admin/gift-reports?cursor= — การ์ดที่นักเขียนรายงานและยังไม่ได้ตัดสิน
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const query = parseSearchParams(request, cursorQuerySchema);
  if ("error" in query) return query.error;

  const searchParams = new URLSearchParams();
  if (query.data.cursor) searchParams.set("cursor", query.data.cursor);

  return forwardToApi({ method: "GET", path: "/admin/gift-reports", token: auth.token, searchParams });
}
