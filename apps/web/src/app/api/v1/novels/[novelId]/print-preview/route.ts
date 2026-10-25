import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/novels/:novelId/print-preview
export async function GET(_request: Request, props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({
    method: "GET",
    path: `/novels/${id.value}/print-preview`,
    token: auth.token,
  });
}
