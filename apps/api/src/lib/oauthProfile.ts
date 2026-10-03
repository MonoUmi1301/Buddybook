import type { OAuthProvider } from "@prisma/client";

/** shape กลางที่ googleOAuth.ts / lineOAuth.ts (และ facebookOAuth.ts ในอนาคต) แปลง response ของ
 *  provider ตัวเองให้ตรงกันหมด — ทำให้ auth.service.ts มี loginOrRegisterWithOAuth() ตัวเดียว
 *  ใช้ได้กับทุก provider แทนที่จะซ้ำ logic หา/สร้าง user ทีละ provider */
export interface OAuthProfile {
  provider: OAuthProvider;
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  /** provider ยืนยันแล้วว่าเจ้าของบัญชีเป็นเจ้าของอีเมลนี้จริง — false = ห้ามใช้อีเมลนี้ผูกกับบัญชีที่มีอยู่แล้ว
   *  (กันยึดบัญชีด้วยการตั้งอีเมลของเหยื่อไว้ในบัญชี provider ที่ไม่ได้ยืนยันอีเมล) */
  email_verified: boolean;
}
