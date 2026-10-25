import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/novels/:novelId/restore — กู้คืนนิยายจากถังขยะ (gap 2.4)
export async function POST(_request: Request, props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "POST", path: `/novels/${id.value}/restore`, token: auth.token, body: {} });
}
