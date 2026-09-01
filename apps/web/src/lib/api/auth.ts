import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/http";

/**
 * เก็บ JWT เป็น httpOnly cookie ฝั่ง Next.js เท่านั้น (อ่านจาก JS ฝั่ง client ไม่ได้)
 * ตามที่ระบุใน BuddyBook_System_Architecture.md ส่วนที่ 2 — "แนบ JWT ใน httpOnly cookie"
 * ค่า maxAge อ้างอิงตาม default ของ apps/api/.env.example (JWT_EXPIRES_IN=15m, JWT_REFRESH_EXPIRES_IN=30d)
 * ถ้าปรับค่าฝั่ง Gateway ให้ปรับที่นี่ให้ตรงกันด้วย
 */
export const ACCESS_TOKEN_COOKIE = "bb_access_token";
export const REFRESH_TOKEN_COOKIE = "bb_refresh_token";

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 นาที
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 วัน

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function getAccessToken(): string | undefined {
  return cookies().get(ACCESS_TOKEN_COOKIE)?.value;
}

export function getRefreshToken(): string | undefined {
  return cookies().get(REFRESH_TOKEN_COOKIE)?.value;
}

/** ใช้ในทุก Route Handler ที่ต้อง login ก่อน (ทุก endpoint ที่ไม่ได้ทำเครื่องหมาย Public ใน API_Endpoints.md) */
export function requireAccessToken(): { token: string } | { error: NextResponse } {
  const token = getAccessToken();
  if (!token) {
    return { error: jsonError("Unauthorized", 401) };
  }
  return { token };
}

export function setAccessTokenCookie(response: NextResponse, accessToken: string): NextResponse {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  return response;
}

export function setAuthCookies(
  response: NextResponse,
  tokens: { access_token: string; refresh_token: string }
): NextResponse {
  setAccessTokenCookie(response, tokens.access_token);
  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
  return response;
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
  return response;
}
