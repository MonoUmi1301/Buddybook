import { requireAccessToken } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validate";
import { completeProfileEmailSchema } from "@/lib/api/schemas";
import { forwardToApi } from "@/lib/api/proxy";

// POST /api/v1/auth/complete-profile/request-otp — Requires auth (รับ token ที่ยังไม่มีอีเมลได้)
// บัญชี LINE ที่ LINE ไม่ส่งอีเมลมา กรอกอีเมล → Express เช็คซ้ำแล้วส่ง OTP (ซ้ำ = 409 "อีเมลนี้มีบัญชีอยู่แล้ว")
export async function POST(request: Request) {
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, completeProfileEmailSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/auth/complete-profile/request-otp", token: auth.token, body: parsed.data });
}
