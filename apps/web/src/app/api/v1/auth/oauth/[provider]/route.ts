import { NextResponse } from "next/server";
import { callApi } from "@/lib/api/proxy";

// GET /api/v1/auth/oauth/:provider — Public, browser navigates here directly (ไม่ใช่ fetch)
// แล้วโดน redirect ต่อไปหน้า consent ของ provider จริง (ตอนนี้รองรับแค่ google)
export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const result = await callApi({ method: "GET", path: `/auth/oauth/${params.provider}` });

  if ("error" in result || result.status !== 200) {
    return NextResponse.redirect(new URL("/login?error=oauth_unavailable", request.url));
  }

  const { redirect_url } = result.json as { redirect_url: string };
  return NextResponse.redirect(redirect_url);
}
