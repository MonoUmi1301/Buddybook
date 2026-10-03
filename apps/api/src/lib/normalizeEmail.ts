import { z } from "zod";

/** อีเมลเก็บ/ค้นแบบตัวพิมพ์เล็กและไม่มีช่องว่างหัวท้ายเสมอ — users.email เป็น unique แบบ case-sensitive
 *  ถ้าไม่ normalize "A@x.com" กับ "a@x.com" จะสมัครได้สองบัญชี และล็อกอินผิดตัวพิมพ์แล้วหาบัญชีไม่เจอ */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** ใช้ใน zod schema ของทุก endpoint ที่รับอีเมล (สมัคร / ยืนยัน OTP / ล็อกอิน / ลืมรหัสผ่าน) */
export const emailSchema = z.string().trim().toLowerCase().email().max(255);
