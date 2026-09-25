import { PROFANITY_EN_STEMS, PROFANITY_TH } from "@/config/profanity";

/**
 * เพิ่มภายหลัง (Gift donations) — ทำความสะอาดข้อความในการ์ดจดหมาย/ชื่อลงท้าย/คำขอบคุณ
 * - ลบทิ้งเงียบ ๆ: แท็ก HTML, อีโมจิ, อักขระควบคุม, บรรทัดว่างเกิน 1 บรรทัด
 * - ปฏิเสธทั้งข้อความ: ลิงก์, อีเมล, เบอร์โทร (กันใช้การ์ดเป็นช่องทางติดต่อ/สแปม/ฟิชชิ่งนักเขียน)
 * - เซ็นเซอร์เป็น *: คำหยาบตาม config/profanity.ts
 * ข้อความแสดงผลเป็น plain text เสมอ (React escape ให้อีกชั้น) ไม่ต้อง decode HTML entity
 */

export type SanitizeRejectReason = "link" | "email" | "phone" | "too_long";

export type SanitizeResult =
  | { ok: true; value: string | null; masked: boolean }
  | { ok: false; reason: SanitizeRejectReason; message: string };

const REJECT_MESSAGES: Record<SanitizeRejectReason, string> = {
  link: "ข้อความมีลิงก์หรือชื่อเว็บไซต์ ซึ่งไม่อนุญาตในการ์ด",
  email: "ข้อความมีอีเมล ซึ่งไม่อนุญาตในการ์ด",
  phone: "ข้อความมีเบอร์โทรศัพท์ ซึ่งไม่อนุญาตในการ์ด",
  too_long: "ข้อความยาวเกินกำหนด",
};

const SCRIPT_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_TAG_RE = /<\/?[a-zA-Z!][^>]*>/g;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
// Extended_Pictographic ครอบคลุมอีโมจิเกือบทั้งหมด ที่เหลือคือชิ้นส่วนประกอบอีโมจิ:
// regional indicator (ธงชาติ), skin tone, variation selector, ZWJ, keycap, tag characters
const EMOJI_RE =
  /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\u{1F3FB}-\u{1F3FF}]|\u{FE0E}|\u{FE0F}|\u{200D}|\u{20E3}|[\u{E0020}-\u{E007F}]/gu;
// อักขระควบคุมทั้งหมดยกเว้น \n (รวม zero-width / bidi override ที่ใช้ซ่อนข้อความ)
// eslint-disable-next-line no-control-regex -- ตั้งใจจับอักขระควบคุมเพื่อลบทิ้ง
const CONTROL_RE =/[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

const EMAIL_RE = /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i;
const URL_RE = /(https?:\/\/|www\.)\S+/i;
const BARE_DOMAIN_RE =
  /\b[a-z0-9-]+(\.[a-z0-9-]+)*\s*\.\s*(com|net|org|io|co|th|me|ly|gg|app|dev|xyz|info|link|to|cc|tv|site|online|shop|bit|tk|ru|cn)\b/i;
// เบอร์ไทย (0x / +66) และเลขยาว ๆ ทั่วไปที่คั่นด้วยช่องว่าง/ขีด/จุด/วงเล็บ — 9 หลักขึ้นไปถือเป็นเบอร์
const PHONE_RE = /(\+?\s*66|\b0)[\s\-.()]*[1-9]([\s\-.()]*\d){7,8}\b|(\d[\s\-.()]*){9,}\d/;

const THAI_DIGITS_RE = /[๐-๙]/g;
const EN_PROFANITY_RE = new RegExp(`\\b(${PROFANITY_EN_STEMS.map(escapeRegExp).join("|")})[a-z]*\\b`, "gi");

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toArabicDigits(s: string) {
  return s.replace(THAI_DIGITS_RE, (d) => String(d.charCodeAt(0) - 0x0e50));
}

/** ลบ HTML/อีโมจิ/อักขระควบคุม และจัดช่องว่าง — ไม่ปฏิเสธอะไร (ใช้ก่อนตรวจทุกครั้ง) */
export function stripUnsafeText(input: string): string {
  return input
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(HTML_COMMENT_RE, "")
    .replace(SCRIPT_STYLE_RE, "")
    .replace(HTML_TAG_RE, "")
    .replace(EMOJI_RE, "")
    .replace(CONTROL_RE, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function maskProfanity(text: string): { value: string; masked: boolean } {
  let masked = false;
  const star = (m: string) => {
    masked = true;
    return "*".repeat([...m].length);
  };
  let value = text.replace(EN_PROFANITY_RE, star);
  for (const word of PROFANITY_TH) {
    if (value.includes(word)) value = value.split(word).join(star(word));
  }
  return { value, masked };
}

function detectContact(text: string): SanitizeRejectReason | null {
  const digits = toArabicDigits(text);
  if (EMAIL_RE.test(text)) return "email";
  if (URL_RE.test(text) || BARE_DOMAIN_RE.test(text)) return "link";
  if (PHONE_RE.test(digits)) return "phone";
  return null;
}

/**
 * ใช้กับทุกช่องข้อความที่ผู้ใช้พิมพ์ในระบบของขวัญ — คืน value = null ถ้าว่างหลังทำความสะอาด
 * maxLength นับเป็นจำนวนอักขระ (code point) หลังทำความสะอาดแล้ว ให้ตรงกับตัวนับฝั่งหน้าเว็บ
 */
export function sanitizeCardText(input: string | null | undefined, maxLength: number): SanitizeResult {
  if (input == null) return { ok: true, value: null, masked: false };

  const cleaned = stripUnsafeText(input);
  if (!cleaned) return { ok: true, value: null, masked: false };

  const reject = detectContact(cleaned);
  if (reject) return { ok: false, reason: reject, message: REJECT_MESSAGES[reject] };

  if ([...cleaned].length > maxLength) {
    return { ok: false, reason: "too_long", message: `${REJECT_MESSAGES.too_long} (สูงสุด ${maxLength} ตัวอักษร)` };
  }

  const { value, masked } = maskProfanity(cleaned);
  return { ok: true, value, masked };
}
