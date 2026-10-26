import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/admin/novels/:novelId/reviewed — สุ่มตรวจแล้วไม่พบปัญหา
export async function PATCH(_request: Request, props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "PATCH", path: `/admin/novels/${id.value}/reviewed`, token: auth.token, body: {} });
}
