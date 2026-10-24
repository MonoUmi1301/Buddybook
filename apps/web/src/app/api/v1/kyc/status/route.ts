import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/kyc/status — สถานะการยืนยันตัวตนล่าสุด (หน้าเว็บ poll ระหว่างรอผล)
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({ method: "GET", path: "/kyc/status", token: auth.token });
}
