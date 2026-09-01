import { NextResponse } from "next/server";
import { callApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { loginSchema } from "@/lib/api/schemas";
import { jsonOk } from "@/lib/api/http";
import { setAuthCookies } from "@/lib/api/auth";

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: { user_id: string; username: string; role: string };
}

interface TwoFactorChallengeResponse {
  requires_2fa: true;
  challenge_token: string;
}

function isLoginResponse(json: unknown): json is LoginResponse {
  if (!json || typeof json !== "object") return false;
  const r = json as Record<string, unknown>;
  return typeof r.access_token === "string" && typeof r.refresh_token === "string" && !!r.user;
}

// เพิ่มภายหลัง (audit fix — 2FA) — รหัสผ่านถูกแล้วแต่บัญชีเปิด 2FA ไว้ backend จะตอบแบบนี้แทน
// (ไม่มี access/refresh token เลย) ต้องส่ง challenge_token ต่อให้ client เพื่อไปกรอกรหัสจากแอป
// Authenticator ที่ POST /auth/login/verify-2fa — ปลอดภัยที่จะส่งออกไปตรง ๆ เพราะเป็นแค่ token
// ชั่วคราวอายุ 5 นาที ใช้ยืนยันตัวตนขั้นที่สองเท่านั้น ไม่ใช่ session token จริง
function isTwoFactorChallengeResponse(json: unknown): json is TwoFactorChallengeResponse {
  if (!json || typeof json !== "object") return false;
  const r = json as Record<string, unknown>;
  return r.requires_2fa === true && typeof r.challenge_token === "string";
}

// POST /api/v1/auth/login — Public (ดู API_Endpoints.md ส่วนที่ 1)
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, loginSchema);
  if ("error" in parsed) return parsed.error;

  const result = await callApi({ method: "POST", path: "/auth/login", body: parsed.data });
  if ("error" in result) return result.error;

  if (result.status === 200 && isTwoFactorChallengeResponse(result.json)) {
    return jsonOk(result.json, 200);
  }

  if (result.status !== 200 || !isLoginResponse(result.json)) {
    // Express ตอบ error ตรง ๆ อยู่แล้ว เช่น {"error":"Invalid credentials"} status 401
    return NextResponse.json(result.json ?? { error: "Login failed" }, { status: result.status });
  }

  // ไม่ส่ง access_token/refresh_token กลับใน body — เก็บเป็น httpOnly cookie เท่านั้น
  // เพื่อไม่ให้ token หลุดไปอยู่ใน JS-accessible response (ตามที่เลือก proxy + httpOnly
  // cookie architecture ใน BuddyBook_System_Architecture.md ส่วนที่ 2)
  const response = jsonOk({ user: result.json.user }, 200);
  return setAuthCookies(response, result.json);
}
