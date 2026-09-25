import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams } from "@/lib/api/validate";
import { cursorQuerySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/me/gifts/sent?cursor=
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const query = parseSearchParams(request, cursorQuerySchema);
  if ("error" in query) return query.error;

  const searchParams = new URLSearchParams();
  if (query.data.cursor) searchParams.set("cursor", query.data.cursor);

  return forwardToApi({ method: "GET", path: "/me/gifts/sent", token: auth.token, searchParams });
}
