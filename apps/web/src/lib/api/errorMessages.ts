/**
 * แปลงข้อความ error ที่ผู้ใช้เห็นเป็นภาษาไทยที่เข้าใจได้ — จุดเดียวสำหรับทุกป็อปอัป/ข้อความแจ้งเตือน
 *
 * ทุก request จากเบราว์เซอร์ผ่าน Next proxy (lib/api/proxy.ts callApi) และ error ที่ proxy สร้างเอง
 * ผ่าน lib/api/http.ts jsonError — ทั้งสองจุดเรียก localizeErrorBody ก่อนส่งกลับ ทำให้ component ที่อ่าน
 * `json.error` ตรง ๆ (ไม่ผ่าน formatApiError) ก็ได้ข้อความภาษาไทยด้วย
 *
 * เดิมผู้ใช้เห็นข้อความดิบจาก API เช่น "Validation failed", "Invalid novel_id", "Forbidden",
 * "email: Invalid email" ซึ่งไม่บอกว่าเกิดอะไรขึ้นหรือต้องทำอะไรต่อ
 * ข้อความต้นฉบับภาษาอังกฤษเก็บไว้ใน `error_en` (ไว้ดูตอน debug ไม่แสดงให้ผู้ใช้)
 */

/** ชื่อช่องข้อมูลที่ผู้ใช้เห็นบนฟอร์ม — ช่องที่ไม่มีในนี้จะแสดงแค่ข้อความ ไม่โชว์ชื่อ field ภาษาโปรแกรม */
export const FIELD_LABELS: Record<string, string> = {
  email: "อีเมล",
  password: "รหัสผ่าน",
  new_password: "รหัสผ่านใหม่",
  current_password: "รหัสผ่านปัจจุบัน",
  confirmPassword: "ยืนยันรหัสผ่าน",
  username: "ชื่อผู้ใช้",
  pen_name: "นามปากกา",
  bio: "แนะนำตัว",
  otp: "รหัส OTP",
  code: "รหัสยืนยัน",
  token: "ลิงก์ยืนยัน",
  birth_date: "วันเกิด",
  title: "ชื่อเรื่อง",
  synopsis: "เรื่องย่อ",
  introduction: "บทนำ",
  content: "เนื้อหา",
  content_snapshot: "เนื้อหา",
  chapter_number: "ลำดับตอน",
  price_coins: "ราคาตอน",
  scheduled_publish_at: "เวลาเผยแพร่",
  status: "สถานะ",
  visibility: "การมองเห็น",
  format: "รูปแบบนิยาย",
  content_rating: "ระดับเนื้อหา",
  legal_status: "ประเภทผลงาน",
  primary_tag_id: "หมวดหมู่หลัก",
  secondary_tag_id: "หมวดหมู่รอง",
  tag_ids: "แท็ก",
  tag_names: "แท็ก",
  cover_image_url: "รูปปก",
  avatar_url: "รูปโปรไฟล์",
  rating: "คะแนนรีวิว",
  comment_text: "ข้อความรีวิว",
  name: "ชื่อ",
  character_name: "ชื่อตัวละคร",
  location_name: "ชื่อสถานที่",
  description: "คำอธิบาย",
  event_title: "ชื่อเหตุการณ์",
  reason: "เหตุผล",
  details: "รายละเอียด",
  message: "ข้อความ",
  subject: "หัวข้อ",
  body: "ข้อความ",
  category: "หมวดเรื่อง",
  attachment_url: "รูปแนบ",
  amount: "จำนวนเงิน",
  amount_coins: "จำนวนเหรียญ",
  custom_coins: "จำนวนเหรียญ",
  quantity: "จำนวน",
  payout_method: "ช่องทางรับเงิน",
  account_name: "ชื่อบัญชี",
  account_number: "เลขบัญชี",
  bank_name: "ธนาคาร",
  thank_message: "ข้อความขอบคุณ",
};

/** ข้อความ error ที่ API ส่งมา (ตรงตัว) → ภาษาไทยที่บอกว่าเกิดอะไรขึ้นและควรทำอะไรต่อ */
const KNOWN: Record<string, string> = {
  // ระบบ/การเชื่อมต่อ
  "Validation failed": "ข้อมูลที่กรอกยังไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  "Invalid JSON body": "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  "Upstream API timeout": "เซิร์ฟเวอร์ตอบช้าเกินไป กรุณาลองใหม่อีกครั้ง",
  "Upstream API unavailable": "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง",
  "Upstream API returned an invalid response": "เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่ภายหลัง",
  "Internal server error": "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
  "Not implemented": "ฟีเจอร์นี้ยังไม่เปิดให้ใช้งาน",
  "Record not found": "ไม่พบข้อมูลนี้ อาจถูกลบไปแล้ว",
  "Unique constraint violation": "ข้อมูลนี้มีอยู่ในระบบแล้ว",
  "Too many requests": "ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  "Bad request": "คำขอไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
  "Not found": "ไม่พบข้อมูลที่ต้องการ",
  Conflict: "ทำรายการนี้ไม่ได้ เพราะข้อมูลถูกเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า",
  Gone: "ข้อมูลนี้ถูกลบถาวรไปแล้ว",
  // บัญชี / เข้าสู่ระบบ
  Unauthorized: "กรุณาเข้าสู่ระบบก่อน",
  "Missing bearer token": "กรุณาเข้าสู่ระบบก่อน",
  "Invalid or expired token": "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  "Invalid or expired refresh token": "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  "Invalid credentials": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "Invalid or expired reset link": "ลิงก์ตั้งรหัสผ่านใหม่หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่",
  "This account has been suspended": "บัญชีนี้ถูกระงับการใช้งาน หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อทีมงาน",
  "Username or email already in use": "ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้ไปแล้ว",
  "Could not generate a unique username": "สร้างชื่อผู้ใช้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  "Google OAuth code exchange failed": "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  "Could not fetch Google profile": "ดึงข้อมูลบัญชี Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  "Facebook OAuth code exchange failed": "เข้าสู่ระบบด้วย Facebook ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  "Could not fetch Facebook profile": "ดึงข้อมูลบัญชี Facebook ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  "LINE OAuth code exchange failed": "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  "Could not verify LINE id_token": "ยืนยันบัญชี LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  Forbidden: "คุณไม่มีสิทธิ์ทำรายการนี้",
  "Admin role required": "หน้านี้สำหรับผู้ดูแลระบบเท่านั้น",
  "User not found": "ไม่พบผู้ใช้นี้",
  "Author not found": "ไม่พบนักเขียนคนนี้",
  "Recipient not found": "ไม่พบผู้รับ",
  // นิยาย / ตอน / เครื่องมือนักเขียน
  "Novel not found": "ไม่พบนิยายเรื่องนี้ อาจถูกลบหรือตั้งเป็นส่วนตัว",
  "Chapter not found": "ไม่พบตอนนี้ อาจถูกลบหรือยังไม่เผยแพร่",
  "Version not found": "ไม่พบเวอร์ชันนี้",
  "Character not found": "ไม่พบตัวละครนี้",
  "Character edge not found": "ไม่พบเส้นความสัมพันธ์นี้",
  "Location not found": "ไม่พบสถานที่นี้",
  "Location edge not found": "ไม่พบเส้นทางนี้",
  "Map version not found": "ไม่พบเวอร์ชันแผนที่นี้",
  "Timeline event not found": "ไม่พบเหตุการณ์นี้",
  "Trash item not found": "ไม่พบรายการนี้ในถังขยะ",
  "Item already restored": "รายการนี้ถูกกู้คืนไปแล้ว",
  "Item already purged": "รายการนี้ถูกลบถาวรไปแล้ว กู้คืนไม่ได้",
  "Unknown trash content type": "กู้คืนรายการนี้ไม่ได้",
  "A character cannot be linked to itself": "เชื่อมตัวละครกับตัวเองไม่ได้",
  "A location cannot be linked to itself": "เชื่อมสถานที่กับตัวเองไม่ได้",
  "Linked chapter must belong to the same novel": "ตอนที่ผูกต้องอยู่ในนิยายเรื่องเดียวกัน",
  "chapter_id does not belong to novel_id": "ตอนนี้ไม่ได้อยู่ในนิยายเรื่องนี้",
  "Tag name already exists": "มีแท็กชื่อนี้อยู่แล้ว",
  "Collection not found": "ไม่พบชั้นหนังสือนี้",
  "Novel already in library": "นิยายเรื่องนี้อยู่ในชั้นหนังสือแล้ว",
  "Novel not in library": "นิยายเรื่องนี้ไม่ได้อยู่ในชั้นหนังสือ",
  "You have already reviewed this novel": "คุณรีวิวนิยายเรื่องนี้ไปแล้ว แก้ไขรีวิวเดิมได้ที่หน้ารีวิว",
  "Invalid parent_comment_id": "ไม่พบคอมเมนต์ที่ต้องการตอบกลับ อาจถูกลบไปแล้ว",
  "Notification not found": "ไม่พบการแจ้งเตือนนี้",
  "Ticket not found": "ไม่พบเรื่องที่แจ้งนี้",
  // เหรียญ / ของขวัญ / การเงิน
  "Insufficient coin balance": "เหรียญไม่พอ กรุณาเติมเหรียญก่อน",
  "This chapter is free": "ตอนนี้อ่านฟรี ไม่ต้องปลดล็อก",
  "You already own this chapter": "คุณปลดล็อกตอนนี้ไปแล้ว",
  "Cannot send a gift to yourself": "ส่งของขวัญให้ตัวเองไม่ได้",
  "Gift not found": "ไม่พบของขวัญนี้",
  "This gift is not available": "ของขวัญชิ้นนี้ไม่เปิดให้ส่งแล้ว",
  "The author has turned off gifts for this novel": "นักเขียนปิดรับของขวัญสำหรับนิยายเรื่องนี้",
  "This author cannot receive gifts right now": "นักเขียนคนนี้ยังรับของขวัญไม่ได้ในตอนนี้",
  "This gift has already been reported": "คุณรายงานของขวัญชิ้นนี้ไปแล้ว",
  "You have already thanked this gift": "คุณขอบคุณของขวัญชิ้นนี้ไปแล้ว",
  "Send exactly one of gift_id or custom_coins": "กรุณาเลือกของขวัญหรือใส่จำนวนเหรียญอย่างใดอย่างหนึ่ง",
  "custom_coins must be positive": "จำนวนเหรียญต้องมากกว่า 0",
  "quantity must be between 1 and 99": "จำนวนต้องอยู่ระหว่าง 1–99",
  "message is required": "กรุณาเขียนข้อความ",
  "idempotency_key was already used for a different gift": "รายการนี้ถูกส่งไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่",
  "novel_id does not belong to author_id": "นิยายเรื่องนี้ไม่ใช่ของนักเขียนคนนี้",
  "Invalid package_id": "ไม่พบแพ็กเกจเติมเงินนี้",
  "Top-up order not found": "ไม่พบรายการเติมเงินนี้",
  "Could not download slip image": "อ่านรูปสลิปไม่ได้ กรุณาอัปโหลดใหม่อีกครั้ง",
  "Withdrawal not found": "ไม่พบคำขอถอนเงินนี้",
  "Withdrawal already processed": "คำขอถอนเงินนี้ดำเนินการไปแล้ว",
  // ติดตาม / รายงาน
  "You cannot follow yourself": "ติดตามตัวเองไม่ได้",
  "You cannot report your own content": "รายงานเนื้อหาของตัวเองไม่ได้",
  "Report not found": "ไม่พบรายงานนี้",
  "Report already resolved": "รายงานนี้ถูกจัดการไปแล้ว",
  "Reported content not found": "เนื้อหาที่ถูกรายงานถูกลบไปแล้ว",
};

/** รูปแบบข้อความที่มีส่วนเปลี่ยนได้ */
const PATTERNS: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/^Invalid [a-z_]+_id$/i, "ลิงก์ไม่ถูกต้องหรือข้อมูลนี้ไม่มีอยู่แล้ว กรุณากลับไปหน้าก่อนหน้าแล้วลองใหม่"],
  [/^Invalid [a-z_]+$/i, "ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง"],
  [/^Request body too large/i, "ข้อมูลใหญ่เกินไป (เกิน 2MB) หากมีรูปในเนื้อหา กรุณาใช้ปุ่มแทรกรูปแทนการวางรูปโดยตรง"],
  [/ not found$/i, "ไม่พบข้อมูลที่ต้องการ อาจถูกลบไปแล้ว"],
  [/OAuth is not configured/i, "ช่องทางเข้าสู่ระบบนี้ยังไม่เปิดใช้งาน กรุณาใช้อีเมลแทน"],
];

/** ข้อความกลางตาม HTTP status เมื่อไม่รู้จักข้อความ — ยังดีกว่าภาษาอังกฤษที่ผู้ใช้อ่านไม่เข้าใจ */
const BY_STATUS: Record<number, string> = {
  400: "ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่",
  401: "กรุณาเข้าสู่ระบบก่อน",
  403: "คุณไม่มีสิทธิ์ทำรายการนี้",
  404: "ไม่พบข้อมูลที่ต้องการ อาจถูกลบไปแล้ว",
  409: "ทำรายการนี้ไม่ได้ในตอนนี้ เพราะข้อมูลถูกเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า",
  410: "ข้อมูลนี้ถูกลบถาวรไปแล้ว",
  413: "ข้อมูลใหญ่เกินไป กรุณาลดขนาดแล้วลองใหม่",
  422: "ทำรายการนี้ไม่ได้ กรุณาตรวจสอบข้อมูลอีกครั้ง",
  429: "ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  502: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง",
  503: "ระบบปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง",
  504: "เซิร์ฟเวอร์ตอบช้าเกินไป กรุณาลองใหม่อีกครั้ง",
};
const GENERIC = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

const THAI = /[฀-๿]/;

export function isThai(text: string): boolean {
  return THAI.test(text);
}

/** ข้อความภาษาอังกฤษที่รู้จัก → ภาษาไทย; ไม่รู้จัก = null */
export function knownErrorMessage(message: string): string | null {
  const known = KNOWN[message.trim()];
  if (known) return known;
  for (const [re, out] of PATTERNS) {
    const m = message.match(re);
    if (m) return typeof out === "function" ? out(m) : out;
  }
  return null;
}

/** ข้อความภาษาอังกฤษ 1 ข้อความ → ภาษาไทย (ข้อความที่เป็นไทยอยู่แล้วคืนตามเดิม, ไม่รู้จัก → ข้อความตาม status) */
export function translateErrorMessage(message: string | undefined, status: number): string {
  if (message && isThai(message)) return message;
  const known = message ? knownErrorMessage(message) : null;
  if (known) return known;
  return BY_STATUS[status] ?? (status >= 500 ? "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง" : GENERIC);
}

type FieldErrors = Record<string, string[] | undefined>;

/** ขึ้นต้นแบบข้อความกลางของ lib/zodThai.ts — ไม่บอกชื่อช่องในตัวเอง */
const GENERIC_PREFIXES = [
  "จำเป็นต้องกรอก",
  "ต้องมีอย่างน้อย",
  "ยาวได้ไม่เกิน",
  "ต้องเลือกอย่างน้อย",
  "เลือกได้ไม่เกิน",
  "ต้องไม่",
  "ต้องมากกว่า",
  "ต้องน้อยกว่า",
  "ต้องเป็น",
  "รูปแบบ",
  "ลิงก์ไม่ถูกต้อง",
  "รหัสอ้างอิงไม่ถูกต้อง",
  "ตัวเลือกไม่ถูกต้อง",
  "ข้อมูลไม่ถูกต้อง",
  "วันที่ไม่ถูกต้อง",
  "ค่า",
  "มีข้อมูลที่ไม่รู้จัก",
];

function isGenericMessage(text: string): boolean {
  return GENERIC_PREFIXES.some((p) => text.startsWith(p));
}

/** รายการ error ราย field → "อีเมล: รูปแบบอีเมลไม่ถูกต้อง · รหัสผ่าน: ต้องมีอย่างน้อย 8 ตัวอักษร" */
export function describeFieldErrors(fieldErrors: FieldErrors | undefined, formErrors?: string[]): string | null {
  const parts: string[] = [];
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    const msg = messages?.[0];
    if (!msg) continue;
    const text = translateErrorMessage(msg, 400);
    const label = FIELD_LABELS[field];
    // ข้อความกลางจาก zod (เช่น "จำเป็นต้องกรอก") ต้องมีชื่อช่องนำหน้าถึงจะรู้ว่าช่องไหน แต่ข้อความที่ schema ตั้งเอง
    // เป็นประโยคครบอยู่แล้ว (เช่น "หัวข้ออย่างน้อย 4 ตัวอักษร") ใส่ชื่อช่องซ้ำจะอ่านแล้วเยิ่นเย้อ
    parts.push(label && isGenericMessage(text) ? `${label}: ${text}` : text);
  }
  for (const msg of formErrors ?? []) parts.push(translateErrorMessage(msg, 400));
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(" · ") : null;
}

interface ErrorBody {
  error?: unknown;
  error_en?: string;
  details?: { fieldErrors?: FieldErrors; formErrors?: string[]; [k: string]: unknown };
  [k: string]: unknown;
}

/**
 * แปลง body ของ error response ให้ `error` เป็นภาษาไทยเสมอ (เก็บต้นฉบับใน `error_en`)
 * validation error ราย field → สรุปเป็นประโยคเดียวพร้อมชื่อช่องภาษาไทย ที่เหลือ (details.code ฯลฯ) คงเดิม
 */
export function localizeErrorBody(status: number, json: unknown): unknown {
  if (status < 400 || !json || typeof json !== "object" || Array.isArray(json)) return json;
  const body = json as ErrorBody;
  const original = typeof body.error === "string" ? body.error : undefined;
  if (original && isThai(original)) return json;

  let error = translateErrorMessage(original, status);
  if (original === "Validation failed") {
    const fields = describeFieldErrors(body.details?.fieldErrors, body.details?.formErrors);
    if (fields) error = `กรุณาตรวจสอบข้อมูล — ${fields}`;
  }
  return { ...body, error, ...(original ? { error_en: original } : {}) };
}
