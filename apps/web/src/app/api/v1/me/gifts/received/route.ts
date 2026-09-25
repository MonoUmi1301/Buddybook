import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams } from "@/lib/api/validate";
import { receivedGiftsQuerySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/me/gifts/received?cursor=&novel_id=&gift_id=&status= — กล่องจดหมายนักเขียน (รวมข้อความ private)
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const query = parseSearchParams(request, receivedGiftsQuerySchema);
  if ("error" in query) return query.error;

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query.data)) {
    if (value) searchParams.set(key, value);
  }

  return forwardToApi({ method: "GET", path: "/me/gifts/received", token: auth.token, searchParams });
}
