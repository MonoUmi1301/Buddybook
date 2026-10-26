import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/admin/dashboard — ข้อมูลหน้าภาพรวม (bento) ของหลังบ้าน
export async function GET() {
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({ method: "GET", path: "/admin/dashboard", token: auth.token });
}
