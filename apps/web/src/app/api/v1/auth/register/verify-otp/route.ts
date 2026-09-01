import { NextResponse } from "next/server";
import { callApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { verifyRegisterOtpSchema } from "@/lib/api/schemas";
import { jsonOk } from "@/lib/api/http";
import { setAuthCookies } from "@/lib/api/auth";

interface VerifyOtpResponse {
  access_token: string;
  refresh_token: string;
  user: { user_id: string; username: string; role: string };
}

function isVerifyOtpResponse(json: unknown): json is VerifyOtpResponse {
  if (!json || typeof json !== "object") return false;
  const r = json as Record<string, unknown>;
  return typeof r.access_token === "string" && typeof r.refresh_token === "string" && !!r.user;
}

// POST /api/v1/auth/register/verify-otp — Public — เพิ่มภายหลัง (audit fix) ขั้นที่สองของสมัคร
// สมาชิก กรอก OTP ถูกต้อง → backend สร้างบัญชีจริง + ออก token ให้เลย (auto-login) เหมือน login
// จริง ต้องตั้ง httpOnly cookie เองที่นี่เหมือน login/route.ts (ไม่ใช่แค่ forwardToApi เฉย ๆ)
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, verifyRegisterOtpSchema);
  if ("error" in parsed) return parsed.error;

  const result = await callApi({ method: "POST", path: "/auth/register/verify-otp", body: parsed.data });
  if ("error" in result) return result.error;

  if (result.status !== 201 || !isVerifyOtpResponse(result.json)) {
    return NextResponse.json(result.json ?? { error: "Verification failed" }, { status: result.status });
  }

  const response = jsonOk({ user: result.json.user }, 201);
  return setAuthCookies(response, result.json);
}
