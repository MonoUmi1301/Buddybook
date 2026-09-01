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
}
