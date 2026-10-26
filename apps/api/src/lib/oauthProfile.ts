import type { OAuthProvider } from "@prisma/client";

/** shape กลางที่ googleOAuth.ts / lineOAuth.ts (และ facebookOAuth.ts ในอนาคต) แปลง response ของ
 *  provider ตัวเองให้ตรงกันหมด — ทำให้ auth.service.ts มี loginOrRegisterWithOAuth() ตัวเดียว
 *  ใช้ได้กับทุก provider แทนที่จะซ้ำ logic หา/สร้าง user ทีละ provider */
export interface OAuthProfile {
  provider: OAuthProvider;
  sub: string;
  /** null = provider ไม่ส่งอีเมลมา (LINE ที่ผู้ใช้ไม่อนุญาตอีเมล) — สร้างบัญชีโดยไม่มีอีเมล แล้วบังคับกรอกที่ /complete-profile */
  email: string | null;
  name: string;
  picture: string | null;
  /** provider ยืนยันแล้วว่าเจ้าของบัญชีเป็นเจ้าของอีเมลนี้จริง — false = ห้ามใช้อีเมลนี้ผูกกับบัญชีที่มีอยู่แล้ว
   *  (กันยึดบัญชีด้วยการตั้งอีเมลของเหยื่อไว้ในบัญชี provider ที่ไม่ได้ยืนยันอีเมล) */
  email_verified: boolean;
  /** gap 3.4 — วันเกิดที่ provider ยืนยันให้ (ตอนนี้มีแค่ Google People API) ใช้ยืนยันอายุ 18+ */
  birthdate?: import("@/lib/ageVerification").BirthDate | null;
}
