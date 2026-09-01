import { requireAccessToken } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validate";
import { disable2faSchema } from "@/lib/api/schemas";
import { forwardToApi } from "@/lib/api/proxy";

// POST /api/v1/auth/2fa/disable — Requires auth — เพิ่มภายหลัง (audit fix — 2FA)
// ต้องกรอกรหัสผ่านซ้ำก่อนปิด 2FA (กันกรณี session ถูกขโมยแล้วสั่งปิด 2FA แทนเจ้าของ)
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, disable2faSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/auth/2fa/disable", token: auth.token, body: parsed.data });
}
