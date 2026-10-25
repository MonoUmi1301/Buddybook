import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { mapDrawingsSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/novels/:novelId/map-drawings
export async function PATCH(request: Request, props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, mapDrawingsSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/novels/${id.value}/map-drawings`,
    token: auth.token,
    body: parsed.data,
  });
}
