import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams } from "@/lib/api/validate";
import { moderationQueueQuerySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/admin/novels/moderation?tab=&page= — คิวตรวจนิยายที่เผยแพร่แล้ว (post-moderation)
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const query = parseSearchParams(request, moderationQueueQuerySchema);
  if ("error" in query) return query.error;

  const searchParams = new URLSearchParams();
  if (query.data.tab) searchParams.set("tab", query.data.tab);
  if (query.data.page) searchParams.set("page", String(query.data.page));
  return forwardToApi({ method: "GET", path: "/admin/novels/moderation", token: auth.token, searchParams });
}
