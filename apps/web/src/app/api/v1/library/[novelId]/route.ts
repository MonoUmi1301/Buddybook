import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// DELETE /api/v1/library/:novelId — เอาออกจากชั้นหนังสือ
export async function DELETE(_request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "DELETE", path: `/library/${id.value}`, token: auth.token });
}
