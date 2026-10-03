import { timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

/**
 * cookie ชั่วคราวของ OAuth flow (Route Handler ฝั่ง Node เท่านั้น — ไม่ใช้ใน middleware)
 *
 * - bb_oauth_state: ผูก state กับเบราว์เซอร์ที่เริ่ม flow — callback ต้องได้ ?state= ตรงกับ cookie นี้
 *   (กัน login CSRF: state จาก apps/api เซ็นไว้ก็จริง แต่ใครก็ขอ state ใหม่ได้ ถ้าไม่ผูกกับเบราว์เซอร์
 *   ผู้โจมตีจะส่งลิงก์ callback ที่มี code ของตัวเองให้เหยื่อกด แล้วเหยื่อล็อกอินเข้าบัญชีผู้โจมตี)
 *   sameSite ต้องเป็น lax — callback เป็น top-level GET ข้ามไซต์จาก Google (strict จะไม่แนบ cookie มา)
 * - bb_oauth_2fa: challenge_token ตอนบัญชีเปิด 2FA — ส่งต่อให้ /login/verify-2fa ผ่าน httpOnly cookie
 *   แทนการใส่ใน URL (ไม่ให้ token ไปค้างใน history/log)
 */
export const OAUTH_STATE_COOKIE = "bb_oauth_state";
export const OAUTH_2FA_COOKIE = "bb_oauth_2fa";

/** ต้องตรงกับ OAUTH_STATE_TTL_MS ของ apps/api (lib/googleOAuth.ts) */
const OAUTH_STATE_MAX_AGE = 10 * 60;
/** ต้องตรงกับอายุ challenge token ของ apps/api (signTwoFactorChallengeToken — 5m) */
const OAUTH_2FA_MAX_AGE = 5 * 60;

const baseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

export function setOAuthStateCookie(response: NextResponse, state: string) {
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    ...baseOptions,
    path: "/api/v1/auth/oauth",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  return response;
}

export function clearOAuthStateCookie(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE, "", { ...baseOptions, path: "/api/v1/auth/oauth", maxAge: 0 });
  return response;
}

export function setOAuth2faCookie(response: NextResponse, challengeToken: string) {
  response.cookies.set(OAUTH_2FA_COOKIE, challengeToken, {
    ...baseOptions,
    path: "/api/v1/auth/login/verify-2fa",
    maxAge: OAUTH_2FA_MAX_AGE,
  });
  return response;
}

export function clearOAuth2faCookie(response: NextResponse) {
  response.cookies.set(OAUTH_2FA_COOKIE, "", { ...baseOptions, path: "/api/v1/auth/login/verify-2fa", maxAge: 0 });
  return response;
}

/** เทียบ state แบบ constant-time — ความยาวต่างกันคืน false (timingSafeEqual จะ throw) */
export function stateMatches(expected: string | undefined, actual: string | null): boolean {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
