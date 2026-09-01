import { NextResponse } from "next/server";
import { callApi } from "@/lib/api/proxy";
import { setAuthCookies } from "@/lib/api/auth";

interface OAuthLoginResponse {
  access_token: string;
  refresh_token: string;
  user: { user_id: string; username: string; role: string };
}

// GET /api/v1/auth/oauth/:provider/callback — Google (หรือ provider อื่น) redirect browser
// มาที่นี่ตรง ๆ พร้อม ?code=...&state=... (ต้องตรงกับ redirect_uri ที่ลงทะเบียนไว้ใน Cloud Console)
export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=oauth_missing_code", request.url));
  }

  const result = await callApi({
    method: "POST",
    path: `/auth/oauth/${params.provider}/callback`,
    body: { code, state },
  });

  if ("error" in result || result.status !== 200) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }

  const { access_token, refresh_token } = result.json as OAuthLoginResponse;
  const response = NextResponse.redirect(new URL("/", request.url));
  return setAuthCookies(response, { access_token, refresh_token });
}
