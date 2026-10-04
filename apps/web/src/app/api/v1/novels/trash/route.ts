import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/novels/trash — นิยายของฉันที่อยู่ในถังขยะ (gap 2.4)
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({ method: "GET", path: "/novels/trash", token: auth.token });
}
