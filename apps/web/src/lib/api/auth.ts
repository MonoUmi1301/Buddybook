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

/** เพิ่มภายหลัง (บั๊ก B1) — cookie "ทำ onboarding แล้ว" ที่ middleware.ts ใช้เป็น fast-path ไม่ผูกกับ user
 *  ถ้าไม่ล้างตอนเปลี่ยนบัญชี บัญชีใหม่ที่ล็อกอินต่อในเบราว์เซอร์เดียวกันจะได้ cookie ของคนก่อนไปด้วย
 *  แล้วข้าม onboarding ได้ (เข้า /search ตรง ๆ ได้เลย) — ล้างทุกครั้งที่ login/logout แทน
 *  ผู้ใช้ที่ตอบ onboarding แล้วจริงจะถูก middleware ส่งผ่าน /onboarding → onboarding-sync ตั้ง cookie คืน
 *  ตามข้อมูลใน DB แล้วพากลับหน้าที่ตั้งใจไป (redirect เงียบ ๆ ครั้งเดียวต่อการล็อกอิน) */
export const HAS_INTERESTS_COOKIE = "bb_has_interests";

function clearHasInterestsCookie(response: NextResponse) {
  response.cookies.set(HAS_INTERESTS_COOKIE, "", { path: "/", sameSite: "lax", maxAge: 0 });
}

export function setAuthCookies(
  response: NextResponse,
  tokens: { access_token: string; refresh_token: string }
): NextResponse {
  clearHasInterestsCookie(response);
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
  clearHasInterestsCookie(response);
  return response;
}
