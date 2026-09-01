import { NextResponse } from "next/server";
import { callApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { verifyLogin2faSchema } from "@/lib/api/schemas";
import { jsonOk } from "@/lib/api/http";
import { setAuthCookies } from "@/lib/api/auth";

interface VerifyLogin2faResponse {
  access_token: string;
  refresh_token: string;
  user: { user_id: string; username: string; role: string };
}

function isVerifyLogin2faResponse(json: unknown): json is VerifyLogin2faResponse {
  if (!json || typeof json !== "object") return false;
  const r = json as Record<string, unknown>;
  return typeof r.access_token === "string" && typeof r.refresh_token === "string" && !!r.user;
}

// POST /api/v1/auth/login/verify-2fa — Public — เพิ่มภายหลัง (audit fix — 2FA)
// ขั้นที่สองของล็อกอิน กรอกรหัส 6 หลักจากแอป Authenticator ถูกต้อง → ออก token จริง
// ต้องตั้ง httpOnly cookie เองที่นี่เหมือน login/route.ts และ register/verify-otp/route.ts
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, verifyLogin2faSchema);
  if ("error" in parsed) return parsed.error;

  const result = await callApi({ method: "POST", path: "/auth/login/verify-2fa", body: parsed.data });
  if ("error" in result) return result.error;

  if (result.status !== 200 || !isVerifyLogin2faResponse(result.json)) {
    return NextResponse.json(result.json ?? { error: "Verification failed" }, { status: result.status });
  }

  const response = jsonOk({ user: result.json.user }, 200);
  return setAuthCookies(response, result.json);
}
