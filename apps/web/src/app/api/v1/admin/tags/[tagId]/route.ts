import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireIntParam } from "@/lib/api/validate";
import { updateTagSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/admin/tags/:tagId — tag_id เป็น SERIAL int ไม่ใช่ UUID
export async function PATCH(request: Request, { params }: { params: { tagId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireIntParam(params.tagId, "tag_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateTagSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/admin/tags/${id.value}`,
    token: auth.token,
    body: parsed.data,
  });
}

// DELETE /api/v1/admin/tags/:tagId
export async function DELETE(_request: Request, { params }: { params: { tagId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireIntParam(params.tagId, "tag_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "DELETE", path: `/admin/tags/${id.value}`, token: auth.token });
}
