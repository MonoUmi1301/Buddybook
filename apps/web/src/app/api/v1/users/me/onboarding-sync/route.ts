import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/api/session";
import { appUrl } from "@/lib/api/config";

/**
 * เพิ่มภายหลัง (bug fix) — GET /api/v1/users/me/onboarding-sync
 * cookie bb_has_interests ถูกตั้งแค่ตอนตอบ onboarding จบ (POST /users/me/interests) ผู้ใช้ที่ตอบไปแล้วแต่
 * ล็อกอินจากเบราว์เซอร์ใหม่/ล้าง cookie จึงไม่มี cookie นี้ → middleware.ts redirect ไป /onboarding →
 * หน้า onboarding เห็น has_interests=true จาก DB แล้ว redirect กลับ "/" → วนลูปไม่รู้จบ
 * Server Component ตั้ง cookie เองไม่ได้ หน้า onboarding จึงส่งมาที่ route handler นี้ (อยู่ใต้ /api
 * ซึ่งยกเว้นจาก redirect ของ middleware) เพื่อตั้ง cookie ตามข้อมูลจริงใน DB แล้วค่อยไปหน้าแรก
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(appUrl("/login"));
  if (!user.has_interests) return NextResponse.redirect(appUrl("/onboarding/interests"));

  // next ต้องเป็น path ในเว็บเดียวกันเท่านั้น (กัน open redirect เช่น "//evil.com")
  const next = new URL(request.url).searchParams.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
  const response = NextResponse.redirect(appUrl(target));
  response.cookies.set("bb_has_interests", "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
