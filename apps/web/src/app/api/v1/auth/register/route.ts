import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { registerSchema } from "@/lib/api/schemas";

// POST /api/v1/auth/register — Public — เพิ่มภายหลัง (audit fix) ขั้นแรกของสมัครสมาชิก 2 ขั้น
// (ยืนยันอีเมลด้วย OTP) แค่ส่งรหัส OTP ไปอีเมล ยังไม่สร้างบัญชี — ดู register/verify-otp/route.ts
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, registerSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/auth/register/request-otp", body: parsed.data });
}
