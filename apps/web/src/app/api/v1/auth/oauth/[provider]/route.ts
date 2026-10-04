import { NextResponse } from "next/server";
import { callApi } from "@/lib/api/proxy";
import { appUrl } from "@/lib/api/config";
import { setOAuthStateCookie } from "@/lib/api/oauth";

// GET /api/v1/auth/oauth/:provider — Public, browser navigates here directly (ไม่ใช่ fetch)
// แล้วโดน redirect ต่อไปหน้า consent ของ provider จริง — เก็บ state ไว้ใน httpOnly cookie ของเบราว์เซอร์นี้
// ให้ callback เทียบว่าเป็นคนเดียวกับที่เริ่ม flow (ดู lib/api/oauth.ts)
export async function GET(_request: Request, { params }: { params: { provider: string } }) {
  const result = await callApi({ method: "GET", path: `/auth/oauth/${params.provider}` });

  if ("error" in result || result.status !== 200) {
    return NextResponse.redirect(appUrl("/login?error=oauth_unavailable"));
  }

  const { redirect_url, state } = result.json as { redirect_url: string; state: string };
  return setOAuthStateCookie(NextResponse.redirect(redirect_url), state);
}
