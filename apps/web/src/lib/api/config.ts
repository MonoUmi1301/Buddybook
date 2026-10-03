/**
 * Base URL ของ Express API Gateway (apps/api) — ใช้เฉพาะฝั่ง server (Route Handlers)
 * ห้ามใช้ NEXT_PUBLIC_ prefix เพราะไม่ต้องการให้ bundle ไปฝั่ง client เลย
 * (client เรียกผ่าน same-origin "/api/v1/..." เท่านั้น ตามสถาปัตยกรรม Gateway เดียว
 * ดู BuddyBook_System_Architecture.md ส่วนที่ 2–3 ในโฟลเดอร์ buddybook_real)
 */
export const API_URL = process.env.API_URL || "http://localhost:4000";

export const API_BASE = `${API_URL}/api/v1`;

/**
 * Base URL ที่เบราว์เซอร์ใช้เข้าเว็บนี้ (ใช้ชื่อเดียวกับ APP_URL ของ apps/api ที่ประกอบ redirect_uri ของ OAuth)
 * redirect ที่ส่งให้เบราว์เซอร์ต้องสร้างจากค่านี้เท่านั้น ห้ามใช้ request.url — ตอนรัน `next dev -H 0.0.0.0`
 * (ใน Docker) request.url ของ Route Handler จะเป็น http://0.0.0.0:3000 ซึ่งเบราว์เซอร์เปิดไม่ได้
 */
export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

/** URL เต็มสำหรับ redirect — path ต้องขึ้นต้นด้วย "/" (path ภายในเว็บเท่านั้น) */
export function appUrl(path: string): URL {
  return new URL(path, APP_URL);
}

/** Timeout ต่อ request ที่ยิงไป Express Gateway */
export const API_TIMEOUT_MS = 10_000;
