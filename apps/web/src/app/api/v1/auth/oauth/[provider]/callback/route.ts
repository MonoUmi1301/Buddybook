import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { callApi } from "@/lib/api/proxy";
import { setAuthCookies } from "@/lib/api/auth";
import { appUrl } from "@/lib/api/config";
import { OAUTH_STATE_COOKIE, clearOAuthStateCookie, setOAuth2faCookie, stateMatches } from "@/lib/api/oauth";

type OAuthLoginResponse =
  | {
      requires_2fa: false;
      access_token: string;
      refresh_token: string;
      user: { user_id: string; username: string; role: string };
    }
  | { requires_2fa: true; challenge_token: string };

/** redirect ไปหน้า login พร้อมรหัส error — ลบ state cookie ทิ้งทุกครั้ง (ใช้ได้ครั้งเดียว) */
function fail(error: string) {
  return clearOAuthStateCookie(NextResponse.redirect(appUrl(`/login?error=${error}`)));
}

// GET /api/v1/auth/oauth/:provider/callback — Google (หรือ provider อื่น) redirect browser
// มาที่นี่ตรง ๆ พร้อม ?code=...&state=... (ต้องตรงกับ redirect_uri ที่ลงทะเบียนไว้ใน Cloud Console)
export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) return fail("oauth_missing_code");

  // state ต้องตรงกับที่เก็บไว้ตอนเริ่ม flow ในเบราว์เซอร์นี้ — ลายเซ็น/อายุเช็คซ้ำอีกชั้นที่ apps/api
  if (!stateMatches(cookies().get(OAUTH_STATE_COOKIE)?.value, state)) return fail("oauth_state");

  const result = await callApi({
    method: "POST",
    path: `/auth/oauth/${params.provider}/callback`,
    body: { code, state },
  });

  if ("error" in result) return fail("oauth_failed");
  // 409 = อีเมลนี้มีบัญชีอยู่แล้วแต่ผูกอัตโนมัติไม่ได้ (provider ไม่ยืนยันอีเมล / ผูกกับ provider อื่นไว้แล้ว)
  if (result.status === 409) return fail("oauth_account_conflict");
  if (result.status === 403) return fail("oauth_suspended");
  if (result.status !== 200) return fail("oauth_failed");

  const body = result.json as OAuthLoginResponse;
  if (body.requires_2fa) {
    // บัญชีเปิด 2FA — ยังไม่ออก session ให้ไปกรอกรหัสจากแอปก่อน (challenge อยู่ใน httpOnly cookie)
    const response = NextResponse.redirect(appUrl("/login?two_factor=oauth"));
    return clearOAuthStateCookie(setOAuth2faCookie(response, body.challenge_token));
  }

  const response = clearOAuthStateCookie(NextResponse.redirect(appUrl("/")));
  return setAuthCookies(response, { access_token: body.access_token, refresh_token: body.refresh_token });
}
