import { requireAccessToken } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validate";
import { confirm2faSchema } from "@/lib/api/schemas";
import { forwardToApi } from "@/lib/api/proxy";

// POST /api/v1/auth/2fa/confirm — Requires auth — เพิ่มภายหลัง (audit fix — 2FA)
// ยืนยันรหัสจากแอป Authenticator ตรงกับ secret ที่เพิ่งสร้าง → เปิดใช้งาน 2FA จริง
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, confirm2faSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/auth/2fa/confirm", token: auth.token, body: parsed.data });
}
