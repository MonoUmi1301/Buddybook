import { requireAccessToken } from "@/lib/api/auth";
import { forwardToApi } from "@/lib/api/proxy";

// POST /api/v1/auth/2fa/setup — Requires auth — เพิ่มภายหลัง (audit fix — 2FA)
// สร้าง secret + QR code ใหม่ (ยังไม่บันทึกลง DB จนกว่าจะ confirm ด้วยรหัสที่ถูกต้อง)
export async function POST() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  return forwardToApi({ method: "POST", path: "/auth/2fa/setup", token: auth.token });
}
