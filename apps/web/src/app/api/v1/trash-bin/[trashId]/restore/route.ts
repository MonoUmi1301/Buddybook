import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/trash-bin/:trashId/restore — กู้คืนภายใน 30 วัน (410 ถ้าเกินกำหนด — ดู Express)
export async function POST(_request: Request, { params }: { params: { trashId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.trashId, "trash_id");
  if ("error" in id) return id.error;

  return forwardToApi({
    method: "POST",
    path: `/trash-bin/${id.value}/restore`,
    token: auth.token,
    body: {},
  });
}
