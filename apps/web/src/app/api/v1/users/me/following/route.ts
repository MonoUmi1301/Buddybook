import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/users/me/following — นักเขียนที่ติดตามอยู่
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({ method: "GET", path: "/users/me/following", token: auth.token });
}
