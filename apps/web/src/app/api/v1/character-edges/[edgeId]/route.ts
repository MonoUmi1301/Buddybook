import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateCharacterEdgeSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/character-edges/:edgeId
export async function PATCH(request: Request, { params }: { params: { edgeId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.edgeId, "edge_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateCharacterEdgeSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/character-edges/${id.value}`,
    token: auth.token,
    body: parsed.data,
  });
}

// DELETE /api/v1/character-edges/:edgeId — ย้ายลงถังขยะ
export async function DELETE(_request: Request, { params }: { params: { edgeId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.edgeId, "edge_id");
  if ("error" in id) return id.error;

  return forwardToApi({
    method: "DELETE",
    path: `/character-edges/${id.value}`,
    token: auth.token,
  });
}
