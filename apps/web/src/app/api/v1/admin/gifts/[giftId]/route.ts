import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateGiftItemSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/admin/gifts/:giftId
export async function PATCH(request: Request, { params }: { params: { giftId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.giftId, "gift_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateGiftItemSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "PATCH", path: `/admin/gifts/${id.value}`, token: auth.token, body: parsed.data });
}

// DELETE /api/v1/admin/gifts/:giftId — ถ้าเคยมีคนส่งชิ้นนี้แล้ว API จะปิดขายแทนการลบ
export async function DELETE(_request: Request, { params }: { params: { giftId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.giftId, "gift_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "DELETE", path: `/admin/gifts/${id.value}`, token: auth.token });
}
