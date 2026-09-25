import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateCollectionSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

type Params = { params: { collectionId: string } };

// PATCH /api/v1/collections/:collectionId — เปลี่ยนชื่อ/อีโมจิ/สี/ลำดับ
export async function PATCH(request: Request, { params }: Params) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.collectionId, "collection_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateCollectionSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "PATCH", path: `/collections/${id.value}`, token: auth.token, body: parsed.data });
}

// DELETE /api/v1/collections/:collectionId — ลบชั้นย่อย (นิยายยังอยู่ในชั้นหนังสือหลัก)
export async function DELETE(_request: Request, { params }: Params) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.collectionId, "collection_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "DELETE", path: `/collections/${id.value}`, token: auth.token });
}
