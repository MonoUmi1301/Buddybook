import { NextResponse } from "next/server";
import { requireAccessToken, setAuthCookies } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validate";
import { completeProfileOtpSchema } from "@/lib/api/schemas";
import { callApi } from "@/lib/api/proxy";
import { jsonOk } from "@/lib/api/http";

interface VerifyResponse {
  access_token: string;
  refresh_token: string;
  user: { user_id: string; username: string; role: string };
}

function isVerifyResponse(json: unknown): json is VerifyResponse {
  if (!json || typeof json !== "object") return false;
  const r = json as Record<string, unknown>;
  return typeof r.access_token === "string" && typeof r.refresh_token === "string" && !!r.user;
}

// POST /api/v1/auth/complete-profile/verify-otp — OTP ถูก → Express บันทึกอีเมลแล้วออก token ชุดใหม่
// (ไม่มี email_required) ต้องตั้ง cookie ทับเองที่นี่ ไม่งั้น proxy.ts ยังเห็น token เก่าแล้วเด้งกลับ /complete-profile
export async function POST(request: Request) {
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, completeProfileOtpSchema);
  if ("error" in parsed) return parsed.error;

  const result = await callApi({ method: "POST", path: "/auth/complete-profile/verify-otp", token: auth.token, body: parsed.data });
  if ("error" in result) return result.error;

  if (result.status !== 200 || !isVerifyResponse(result.json)) {
    return NextResponse.json(result.json ?? { error: "Verification failed" }, { status: result.status });
  }

  return setAuthCookies(jsonOk({ user: result.json.user }), result.json);
}
