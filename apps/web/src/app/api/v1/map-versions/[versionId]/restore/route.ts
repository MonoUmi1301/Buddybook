import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/map-versions/:versionId/restore
export async function POST(_request: Request, props: { params: Promise<{ versionId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.versionId, "version_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "POST", path: `/map-versions/${id.value}/restore`, token: auth.token });
}
