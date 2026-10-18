/** อ่าน payload ของ JWT โดยไม่ verify ลายเซ็น — ใช้ตัดสินใจฝั่ง UI/redirect เท่านั้น
 *  (สิทธิ์จริงทุกอย่าง Express verify เองทุก request) ใช้ได้ทั้ง middleware (edge) และ route handler */
export function decodeJwtPayload(token: string | undefined): { user_id?: string; exp?: number } | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as { user_id?: string; exp?: number };
  } catch {
    return null;
  }
}
