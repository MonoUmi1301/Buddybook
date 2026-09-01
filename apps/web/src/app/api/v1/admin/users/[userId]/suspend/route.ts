import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/admin/users/:userId/suspend
export async function PATCH(_request: Request, { params }: { params: { userId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.userId, "user_id");
  if ("error" in id) return id.error;

  return forwardToApi({
    method: "PATCH",
    path: `/admin/users/${id.value}/suspend`,
    token: auth.token,
    body: {},
  });
}
