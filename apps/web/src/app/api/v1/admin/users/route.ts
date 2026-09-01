import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams } from "@/lib/api/validate";
import { paginationQuerySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/admin/users?page=
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = parseSearchParams(request, paginationQuerySchema);
  if ("error" in parsed) return parsed.error;

  const searchParams = new URLSearchParams({ page: String(parsed.data.page) });

  return forwardToApi({
    method: "GET",
    path: "/admin/users",
    token: auth.token,
    searchParams,
  });
}
