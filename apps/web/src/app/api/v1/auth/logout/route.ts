import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { logoutSchema } from "@/lib/api/schemas";
import { jsonNoContent } from "@/lib/api/http";
import { getRefreshToken, clearAuthCookies } from "@/lib/api/auth";

// POST /api/v1/auth/logout
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, logoutSchema);
  if ("error" in parsed) return parsed.error;

  const refreshToken = parsed.data.refresh_token ?? getRefreshToken();
  if (refreshToken) {
    // best-effort — เคลียร์ cookie ฝั่งเราเสมอแม้ Express จะ error/unreachable
    await forwardToApi({ method: "POST", path: "/auth/logout", body: { refresh_token: refreshToken } });
  }

  return clearAuthCookies(jsonNoContent());
}
