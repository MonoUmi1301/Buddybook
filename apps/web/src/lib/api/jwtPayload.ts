/** อ่าน payload ของ JWT โดยไม่ verify ลายเซ็น — ใช้ตัดสินใจฝั่ง UI/redirect เท่านั้น
 *  (สิทธิ์จริงทุกอย่าง Express verify เองทุก request) ใช้ได้ทั้ง middleware (edge) และ route handler */
/** email_required = บัญชียังไม่มีอีเมล (LINE ไม่ส่งมา) — proxy.ts พาไป /complete-profile */
type JwtPayload = { user_id?: string; exp?: number; email_required?: boolean };

export function decodeJwtPayload(token: string | undefined): JwtPayload | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as JwtPayload;
  } catch {
    return null;
  }
}
