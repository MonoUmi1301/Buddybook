import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams } from "@/lib/api/validate";
import { adminUsersQuerySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/admin/users?page=&type=all|real|demo
export async function GET(request: Request) {
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = parseSearchParams(request, adminUsersQuerySchema);
  if ("error" in parsed) return parsed.error;

  const searchParams = new URLSearchParams({ page: String(parsed.data.page), type: parsed.data.type });

  return forwardToApi({
    method: "GET",
    path: "/admin/users",
    token: auth.token,
    searchParams,
  });
}
