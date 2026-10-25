import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// DELETE /api/v1/collections/:collectionId/items/:novelId — เอานิยายออกจากชั้นย่อย
export async function DELETE(
  _request: Request,
  props: { params: Promise<{ collectionId: string; novelId: string }> }
) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const collection = requireUuidParam(params.collectionId, "collection_id");
  if ("error" in collection) return collection.error;
  const novel = requireUuidParam(params.novelId, "novel_id");
  if ("error" in novel) return novel.error;

  return forwardToApi({
    method: "DELETE",
    path: `/collections/${collection.value}/items/${novel.value}`,
    token: auth.token,
  });
}
