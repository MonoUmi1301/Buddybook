/** สมัครสมาชิกได้เฉพาะอีเมลจากผู้ให้บริการจริงที่รู้จัก — กันการกรอกโดเมนมั่ว ๆ อย่าง @hippo.com
 *  (บัญชีเดิมที่ใช้โดเมนอื่นยังล็อกอินได้ตามปกติ — เช็คแค่ตอนสมัคร/ผูกอีเมลใหม่)
 *  รายการเดียวกันอยู่ที่ apps/api/src/lib/emailDomains.ts (API เช็คซ้ำอีกชั้น) — แก้ต้องแก้ทั้งสองที่ */
export const ALLOWED_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.co.th",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.co.th",
  "live.com",
  "live.co.uk",
  "msn.com",
  "yahoo.com",
  "yahoo.co.th",
  "yahoo.co.uk",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "aol.com",
  "gmx.com",
  "zoho.com",
  "yandex.com",
  "mail.com",
]);

export const EMAIL_DOMAIN_ERROR = "กรุณาใช้อีเมลจากผู้ให้บริการจริง เช่น @gmail.com, @hotmail.com, @outlook.com, @yahoo.com หรือ @icloud.com";

export function isAllowedEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  return ALLOWED_EMAIL_DOMAINS.has(domain);
}
