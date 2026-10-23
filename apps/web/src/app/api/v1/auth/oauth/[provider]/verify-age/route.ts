import { NextResponse } from "next/server";
import { callApi } from "@/lib/api/proxy";
import { appUrl } from "@/lib/api/config";
import { getAccessToken } from "@/lib/api/auth";
import { safeReturnPath, setOAuthAgeVerifyCookie, setOAuthStateCookie, withAgeVerifyResult } from "@/lib/api/oauth";

// GET /api/v1/auth/oauth/google/verify-age?return_to=/novels/.. — ปุ่ม "ยืนยันอายุด้วย Google" (browser navigate มาตรง ๆ)
// ต้องล็อกอินอยู่แล้ว: ขอวันเกิดจาก Google มายืนยันอายุของบัญชีนี้ ไม่ได้ล็อกอินด้วย Google
// callback กลับมาที่ /api/v1/auth/oauth/google/callback ตัวเดิม (แยก flow ด้วย cookie bb_oauth_age_verify)
export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const returnTo = safeReturnPath(new URL(request.url).searchParams.get("return_to"));
  if (params.provider !== "google") {
    return NextResponse.redirect(appUrl(withAgeVerifyResult(returnTo, "unavailable")));
  }
  if (!getAccessToken()) return NextResponse.redirect(appUrl("/login"));

  const result = await callApi({
    method: "GET",
    path: "/auth/oauth/google",
    searchParams: new URLSearchParams({ purpose: "verify_age" }),
  });
  if ("error" in result || result.status !== 200) {
    return NextResponse.redirect(appUrl(withAgeVerifyResult(returnTo, "unavailable")));
  }

  const { redirect_url, state } = result.json as { redirect_url: string; state: string };
  return setOAuthAgeVerifyCookie(setOAuthStateCookie(NextResponse.redirect(redirect_url), state), returnTo);
}

