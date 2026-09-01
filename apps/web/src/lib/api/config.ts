/**
 * Base URL ของ Express API Gateway (apps/api) — ใช้เฉพาะฝั่ง server (Route Handlers)
 * ห้ามใช้ NEXT_PUBLIC_ prefix เพราะไม่ต้องการให้ bundle ไปฝั่ง client เลย
 * (client เรียกผ่าน same-origin "/api/v1/..." เท่านั้น ตามสถาปัตยกรรม Gateway เดียว
 * ดู BuddyBook_System_Architecture.md ส่วนที่ 2–3 ในโฟลเดอร์ buddybook_real)
 */
export const API_URL = process.env.API_URL || "http://localhost:4000";

export const API_BASE = `${API_URL}/api/v1`;

/** Timeout ต่อ request ที่ยิงไป Express Gateway */
export const API_TIMEOUT_MS = 10_000;
