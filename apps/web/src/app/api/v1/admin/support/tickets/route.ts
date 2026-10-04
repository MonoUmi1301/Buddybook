import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";
import { pickSearchParams } from "@/lib/api/query";

// GET /api/v1/admin/support/tickets?status= — คิวเรื่องแจ้งปัญหา (gap 3.2)
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({
    method: "GET",
    path: "/admin/support/tickets",
    token: auth.token,
    searchParams: pickSearchParams(request, ["status"]),
  });
}
