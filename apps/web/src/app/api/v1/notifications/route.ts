import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";
import { pickSearchParams } from "@/lib/api/query";

// GET /api/v1/notifications?page&pageSize&type&unread_only (gap 3.3 — แบ่งหน้า/กรอง)
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  return forwardToApi({
    method: "GET",
    path: "/notifications",
    token: auth.token,
    searchParams: pickSearchParams(request, ["page", "pageSize", "type", "unread_only"]),
  });
}
