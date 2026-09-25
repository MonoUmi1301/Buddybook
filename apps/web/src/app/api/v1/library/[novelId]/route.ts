import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateLibraryStatusSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/library/:novelId — เปลี่ยนสถานะในชั้น (กำลังอ่าน / อ่านต่อไป / อ่านจบแล้ว)
export async function PATCH(request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateLibraryStatusSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "PATCH", path: `/library/${id.value}`, token: auth.token, body: parsed.data });
}

// DELETE /api/v1/library/:novelId — เอาออกจากชั้นหนังสือ
export async function DELETE(_request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "DELETE", path: `/library/${id.value}`, token: auth.token });
}
