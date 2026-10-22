import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { resolveModerationSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/admin/novels/:novelId/moderation — คืนสถานะ / ยืนยันการระงับหลังอุทธรณ์
export async function PATCH(request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, resolveModerationSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "PATCH", path: `/admin/novels/${id.value}/moderation`, token: auth.token, body: parsed.data });
}
