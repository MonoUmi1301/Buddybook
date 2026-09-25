import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { collectionItemSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/collections/:collectionId/items — ใส่นิยายลงชั้นย่อย (เพิ่มเข้าชั้นหลักให้ด้วยถ้ายังไม่มี)
export async function POST(request: Request, { params }: { params: { collectionId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.collectionId, "collection_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, collectionItemSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: `/collections/${id.value}/items`, token: auth.token, body: parsed.data });
}
