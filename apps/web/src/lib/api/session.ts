import { getAccessToken } from "@/lib/api/auth";
import { callApi } from "@/lib/api/proxy";

export interface SessionUser {
  user_id: string;
  username: string;
  pen_name: string | null;
  email: string;
  role: "user" | "admin";
  avatar_url: string | null;
  bio: string | null;
  age_verified: boolean;
  has_interests: boolean;
  has_password: boolean;
  totp_enabled: boolean;
}

/**
 * ใช้ใน Server Component เท่านั้น (อ่าน httpOnly cookie ผ่าน next/headers) —
 * เรียกครั้งเดียวต่อหน้าแล้วส่งต่อเป็น prop ให้ Navbar/UserMenu แทนการ hardcode mockUser
 * คืน null เสมอถ้าไม่ได้ล็อกอิน/token หมดอายุ (ไม่ throw — หน้า public ต้อง render ได้ปกติ)
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = getAccessToken();
  if (!token) return null;

  const result = await callApi({ method: "GET", path: "/users/me", token });
  if ("error" in result || result.status !== 200) return null;

  return result.json as SessionUser;
}
