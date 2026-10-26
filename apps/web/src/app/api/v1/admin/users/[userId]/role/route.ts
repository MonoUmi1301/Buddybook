import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateUserRoleSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/admin/users/:userId/role
export async function PATCH(request: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.userId, "user_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateUserRoleSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/admin/users/${id.value}/role`,
    token: auth.token,
    body: parsed.data,
  });
}
