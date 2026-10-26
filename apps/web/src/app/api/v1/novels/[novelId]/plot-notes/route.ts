import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { plotNotesSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/novels/:novelId/plot-notes
export async function PATCH(request: Request, props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, plotNotesSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/novels/${id.value}/plot-notes`,
    token: auth.token,
    body: parsed.data,
  });
}
