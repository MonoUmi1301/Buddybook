import { authenticator } from "otplib";
import QRCode from "qrcode";

// เพิ่มภายหลัง (audit fix) — 2FA แบบ TOTP (RFC 6238) ผ่านแอป Authenticator (Google Authenticator/
// Authy/Microsoft Authenticator ฯลฯ) เหมือน GitHub ทำงานแบบ offline ล้วน ๆ (ไม่ต้องส่งอีเมล/SMS
// เลย — client กับ server คำนวณรหัสจาก secret ร่วมกัน + เวลาปัจจุบัน) จึงไม่มีปัญหาเรื่องผู้ให้บริการ
// ส่งอีเมล/sandbox แบบ OTP ตอนสมัคร
const ISSUER = "BuddyBook";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildTotpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function generateTotpQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}
