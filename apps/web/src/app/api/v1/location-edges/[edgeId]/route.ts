import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// DELETE /api/v1/location-edges/:edgeId — ย้ายลงถังขยะ
export async function DELETE(_request: Request, { params }: { params: { edgeId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.edgeId, "edge_id");
  if ("error" in id) return id.error;

  return forwardToApi({
    method: "DELETE",
    path: `/location-edges/${id.value}`,
    token: auth.token,
  });
}
