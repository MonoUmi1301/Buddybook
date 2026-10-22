import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/admin/reports/activity — เติมเหรียญ/ส่งของขวัญล่าสุด (hero หน้าภาพรวมหลังบ้าน)
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  return forwardToApi({ method: "GET", path: "/admin/reports/activity", token: auth.token });
}
