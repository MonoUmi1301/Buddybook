import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams } from "@/lib/api/validate";
import { withdrawalsQuerySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/admin/withdrawals?status=
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const query = parseSearchParams(request, withdrawalsQuerySchema);
  if ("error" in query) return query.error;

  const searchParams = new URLSearchParams();
  if (query.data.status) searchParams.set("status", query.data.status);
  return forwardToApi({ method: "GET", path: "/admin/withdrawals", token: auth.token, searchParams });
}
