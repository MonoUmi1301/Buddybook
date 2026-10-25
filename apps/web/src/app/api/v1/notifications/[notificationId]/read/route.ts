import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/notifications/:notificationId/read
export async function PATCH(_request: Request, props: { params: Promise<{ notificationId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.notificationId, "notification_id");
  if ("error" in id) return id.error;

  return forwardToApi({
    method: "PATCH",
    path: `/notifications/${id.value}/read`,
    token: auth.token,
    body: {},
  });
}
