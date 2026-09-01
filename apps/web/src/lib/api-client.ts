import axios from "axios";

/**
 * Axios instance กลาง สำหรับเรียก API ของ BuddyBook เอง
 * - Base URL เป็น same-origin "/api/v1" เสมอ (Route Handlers ใน src/app/api/v1/...)
 *   ไม่เรียก Express Gateway (apps/api) ตรง ๆ จาก client — ต้องผ่าน Next.js เท่านั้น
 *   ตามสถาปัตยกรรม Gateway เดียวใน BuddyBook_System_Architecture.md
 * - Auth ใช้ httpOnly cookie (ตั้งโดย Route Handler ของ /auth/login, /auth/register,
 *   /auth/refresh — ดู lib/api/auth.ts) จึงไม่ต้องแนบ Authorization header จาก client เอง
 *   แค่ withCredentials: true ให้ browser ส่ง cookie ไปด้วยพอ
 */
export const apiClient = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});
