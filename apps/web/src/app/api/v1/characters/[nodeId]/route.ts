import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateCharacterSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/characters/:nodeId
export async function PATCH(request: Request, props: { params: Promise<{ nodeId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.nodeId, "node_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateCharacterSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/characters/${id.value}`,
    token: auth.token,
    body: parsed.data,
  });
}

// DELETE /api/v1/characters/:nodeId — ย้ายลงถังขยะ
export async function DELETE(_request: Request, props: { params: Promise<{ nodeId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.nodeId, "node_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "DELETE", path: `/characters/${id.value}`, token: auth.token });
}
