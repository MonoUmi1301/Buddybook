import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// DELETE /api/v1/trash-bin/:trashId — ลบถาวรจริง (ทางเดียวที่ hard-delete ได้)
export async function DELETE(_request: Request, { params }: { params: { trashId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.trashId, "trash_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "DELETE", path: `/trash-bin/${id.value}`, token: auth.token });
}
