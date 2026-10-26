import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { suspendNovelSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/admin/novels/:novelId/suspend — ระงับนิยาย (เหตุผลบังคับ) แจ้งนักเขียนทั้งในเว็บและอีเมล
export async function PATCH(request: Request, props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, suspendNovelSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "PATCH", path: `/admin/novels/${id.value}/suspend`, token: auth.token, body: parsed.data });
}
