import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateLocationSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/locations/:locationId
export async function PATCH(request: Request, { params }: { params: { locationId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.locationId, "location_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateLocationSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/locations/${id.value}`,
    token: auth.token,
    body: parsed.data,
  });
}

// DELETE /api/v1/locations/:locationId — ย้ายลงถังขยะ
export async function DELETE(_request: Request, { params }: { params: { locationId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.locationId, "location_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "DELETE", path: `/locations/${id.value}`, token: auth.token });
}
