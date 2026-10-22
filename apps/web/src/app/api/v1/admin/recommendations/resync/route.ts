import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";

// GET  /api/v1/admin/recommendations/resync — สถานะรอบ resync กราฟ Neo4j
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({ method: "GET", path: "/admin/recommendations/resync", token: auth.token });
}

// POST /api/v1/admin/recommendations/resync — เริ่มสร้างความสัมพันธ์ผู้ใช้ในกราฟใหม่ทั้งหมด (รันเบื้องหลัง)
export async function POST() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({ method: "POST", path: "/admin/recommendations/resync", token: auth.token, body: {} });
}
