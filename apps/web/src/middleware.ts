import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/api/auth";

/**
 * Silent Token Refresh สำหรับ Persistent Session
 *
 * ปัญหาเดิม: bb_access_token cookie ตั้ง maxAge เท่ากับอายุ JWT (15 นาที) พอครบเวลา cookie
 * หายไปเองจากเบราว์เซอร์ — getCurrentUser() ที่ทำงานในทุก Server Component (หน้าแรก/library/
 * novel-detail ฯลฯ) เห็นแค่ "ไม่มี token" คืน null (= guest) ทันที ไม่เคยลองขอ token ใหม่ด้วย
 * refresh token (อายุ 30 วัน) เลยสักครั้ง
 *
 * AuthFetchInterceptor.tsx (client-side) แก้ได้แค่ตอนกดปุ่มที่ยิง fetch("/api/v1/...") เท่านั้น
 * Server Component render คนละ mechanism กัน set cookie เองระหว่าง render ไม่ได้ (ข้อจำกัดของ
 * Next.js App Router) ต้องทำที่ middleware ซึ่งรันก่อน Server Component ทุกตัวเท่านั้น
 *
 * เวอร์ชันนี้ decode JWT อ่านค่า exp ตรง ๆ (ไม่ต้อง verify ลายเซ็น แค่เช็คว่าใกล้หมดอายุหรือยัง)
 * แทนการเช็คแค่ "cookie มีอยู่ไหม" เดิม — ป้องกัน edge case ที่ cookie maxAge กับ JWT exp
 * ไม่ตรงกันเป๊ะในอนาคต และรีเฟรชล่วงหน้าก่อนหมดอายุจริงไม่กี่วินาที ลดโอกาสที่ request แรกหลัง
 * refresh จะยังโดน 401 อยู่เพราะ token หมดอายุพอดีระหว่างทาง
 */
const REFRESH_THRESHOLD_SECONDS = 60;

function decodeJwtExpirySeconds(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64)) as { exp?: number };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function needsRefresh(accessToken: string | undefined): boolean {
  if (!accessToken) return true;
  const exp = decodeJwtExpirySeconds(accessToken);
  if (exp === null) return true; // decode ไม่ได้ (token เพี้ยน/ปลอม) — ให้ลอง refresh ใหม่ปลอดภัยกว่า
  const nowSeconds = Date.now() / 1000;
  return exp - nowSeconds < REFRESH_THRESHOLD_SECONDS;
}

/** เพิ่มภายหลัง (Phase R, MASTER BRIEF) — เส้นทางที่ต้อง "ยกเว้น" จากการบังคับ redirect ไป
 *  /onboarding เสมอ ไม่งั้นจะ redirect loop (เข้า /onboarding เองก็โดนเด้งกลับ /onboarding),
 *  พัง auth flow (/login), หรือพัง client fetch ทุกตัวที่ยิงไป /api/* (ได้ HTML redirect
 *  กลับมาแทน JSON) — หน้ากฎหมาย/ข้อมูลทั่วไปก็ยกเว้นไว้ด้วย ไม่มีเหตุผลผลิตภัณฑ์ที่จะบล็อกได้ */
const ONBOARDING_EXEMPT_PREFIXES = [
  "/onboarding",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api",
  "/terms",
  "/privacy",
  "/about",
  "/contact",
  "/guide",
];

function isOnboardingExempt(pathname: string): boolean {
  return ONBOARDING_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const HAS_INTERESTS_COOKIE = "bb_has_interests";

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  let response: NextResponse | null = null;
  let effectiveAccessToken = accessToken;

  if (needsRefresh(accessToken) && refreshToken) {
    try {
      const apiBase = process.env.API_URL || "http://localhost:4000";
      const res = await fetch(`${apiBase}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (res.ok) {
        const json = (await res.json().catch(() => null)) as { access_token?: string } | null;
        if (json?.access_token) {
          // จุดสำคัญ: ต้องอัปเดต request.cookies ด้วย ไม่ใช่แค่ response.cookies — response.cookies.set
          // อย่างเดียวส่ง Set-Cookie ให้ browser เก็บไว้ใช้ "ครั้งถัดไป" เท่านั้น แต่ Server Component
          // ที่กำลังจะ render ต่อจาก request ปัจจุบัน (เช่น getCurrentUser() ในหน้าที่เพิ่ง navigate ไป)
          // ยังอ่านค่าเดิมจาก request ตัวเดิมอยู่ ถ้าไม่ mutate request.cookies ด้วย หน้าที่เพิ่งกด
          // เข้ามาจะยังเห็น token เก่า (หมดอายุ) อยู่ดี แล้วโดน redirect ไป /login ทั้งที่ refresh
          // สำเร็จแล้วจริง ๆ (เพิ่งเจอบั๊กนี้จริงตอนทดสอบ — เป็น gotcha ที่รู้จักกันดีของ Next.js middleware)
          request.cookies.set(ACCESS_TOKEN_COOKIE, json.access_token);
          effectiveAccessToken = json.access_token;

          response = NextResponse.next({ request });
          response.cookies.set(ACCESS_TOKEN_COOKIE, json.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 15 * 60,
          });
        }
      }
      // refresh token หมดอายุ/invalid (res ไม่ ok) — ปล่อยผ่านเป็น guest ตามปกติ ไม่ redirect เอง
      // ที่นี่ ให้แต่ละหน้าตัดสินใจเอง (บางหน้า public ต้องเห็นได้แม้ไม่ได้ล็อกอิน)
    } catch {
      // API เข้าไม่ถึง (เช่น server รีสตาร์ทพอดี) — ปล่อยผ่านไปเป็น guest ชั่วคราว
      // ดีกว่าทำให้ทั้งหน้าเว็บพังเพราะ middleware error
    }
  }

  // เพิ่มภายหลัง (Phase R) — บังคับผู้ใช้ที่ล็อกอินแล้วแต่ยังไม่ตอบ Onboarding ให้กลับไปตอบก่อนเสมอ
  // จากทุกหน้า (ไม่ใช่แค่หน้าแรกเหมือนเดิม) — เช็คผ่าน cookie bb_has_interests (ไม่ใช่ httpOnly,
  // เขียนโดย POST /api/v1/users/me/interests ตอนตอบจบ) แทนการเรียก API เช็ค DB ทุก request
  // (แพงเกินไปสำหรับ middleware ที่รันทุกหน้า) — เป็น fast-path เท่านั้น หน้า /onboarding เองยังมี
  // เช็ค has_interests จริงจาก DB ซ้ำอีกชั้น ถ้า cookie ยังไม่ sync (เช่น ล็อกอินเครื่องใหม่) ก็แค่
  // เด้งผ่าน /onboarding ไปหน้าแรกทันทีเงียบ ๆ ไม่ใช่ bug
  const pathname = request.nextUrl.pathname;
  if (
    effectiveAccessToken &&
    !request.cookies.get(HAS_INTERESTS_COOKIE)?.value &&
    !isOnboardingExempt(pathname)
  ) {
    const redirectResponse = NextResponse.redirect(new URL("/onboarding", request.url));
    if (response) {
      // คง Set-Cookie ของ access token ที่เพิ่ง refresh ไว้ด้วย ไม่งั้นจะเสียการ refresh ที่เพิ่งทำไป
      response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
    }
    return redirectResponse;
  }

  return response ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
