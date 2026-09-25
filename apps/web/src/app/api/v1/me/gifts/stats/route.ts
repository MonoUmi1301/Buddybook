import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/me/gifts/stats — สถิติของขวัญที่นักเขียนได้รับ (เดือนนี้/ทั้งหมด, ของขวัญยอดนิยม, ผู้สนับสนุน)
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  return forwardToApi({ method: "GET", path: "/me/gifts/stats", token: auth.token });
}
