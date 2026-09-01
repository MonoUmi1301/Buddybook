import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "@/config/env";
import type { UserRole } from "@prisma/client";

export interface TokenPayload {
  user_id: string;
  role: UserRole;
}

// env.JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN คือ duration string เช่น "15m"/"30d"
// (ตั้งค่าโดย developer ผ่าน .env ไม่ใช่ user input) — jsonwebtoken@9 type ต้องการ
// ms's StringValue แทน string เฉย ๆ
export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as StringValue });
}

export function signRefreshToken(payload: TokenPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as StringValue,
  });
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

interface ResetTokenPayload {
  user_id: string;
  purpose: "password_reset";
}

/** เซ็นด้วย JWT_REFRESH_SECRET + purpose claim (ไม่ใช่ JWT_SECRET ของ access token) โดยตั้งใจ —
 *  กันไม่ให้ reset token ถูกเอาไปใช้แทน access token ได้ (verifyAccessToken เช็คลายเซ็นกับ
 *  JWT_SECRET คนละตัว จะ verify token นี้ไม่ผ่านทันที) หมดอายุสั้นกว่า refresh token มาก */
export function signResetToken(user_id: string) {
  return jwt.sign({ user_id, purpose: "password_reset" } satisfies ResetTokenPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: "30m",
  });
}

export function verifyResetToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as ResetTokenPayload;
  if (payload.purpose !== "password_reset") {
    throw new Error("Not a password reset token");
  }
  return payload.user_id;
}

interface TwoFactorChallengePayload {
  user_id: string;
  purpose: "2fa_challenge";
}

/** เพิ่มภายหลัง (audit fix) — 2FA ผ่านแอป Authenticator (TOTP) เหมือน GitHub — ล็อกอินขั้นแรก
 *  (รหัสผ่านถูก) ยังไม่ออก access/refresh token ทันทีถ้าบัญชีเปิด 2FA ไว้ ออก challenge token
 *  อายุสั้นแทน (เหมือน reset token — คนละ purpose คนละความหมาย verifyAccessToken จะไม่รับ
 *  token นี้เด็ดขาดเพราะเซ็นด้วย secret คนละตัว) ให้ frontend ส่งกลับมาพร้อมรหัสจากแอปที่ขั้นสอง */
export function signTwoFactorChallengeToken(user_id: string) {
  return jwt.sign({ user_id, purpose: "2fa_challenge" } satisfies TwoFactorChallengePayload, env.JWT_REFRESH_SECRET, {
    expiresIn: "5m",
  });
}

export function verifyTwoFactorChallengeToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as TwoFactorChallengePayload;
  if (payload.purpose !== "2fa_challenge") {
    throw new Error("Not a 2FA challenge token");
  }
  return payload.user_id;
}
