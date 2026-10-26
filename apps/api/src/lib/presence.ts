/**
 * ผู้อ่านออนไลน์แบบใกล้เรียลไทม์ — หน้าอ่านตอนส่ง heartbeat (POST /presence/heartbeat) ทุก HEARTBEAT_MS
 * ตอนแท็บเปิดอยู่บนจอ ผู้ใช้ที่ไม่ส่งมาเกิน ONLINE_WINDOW_MS ถือว่าออฟไลน์
 *
 * เดิมหน้าแอดมินนับผู้ใช้ที่ reading_progress.last_read_at อยู่ใน 15 นาทีล่าสุด — ค่านั้นอัปเดตตอน
 * "เปิดตอน" เท่านั้น คนที่อ่านตอนยาวเกิน 15 นาทีหายไปจากยอด ส่วนคนที่ปิดแท็บไปแล้วยังถูกนับอีก 15 นาที
 *
 * เก็บใน memory ของ process (ยังไม่มี Redis — แบบเดียวกับ rateLimit.middleware.ts) ถ้ารัน api หลาย instance
 * ต้องย้ายไปที่เก็บกลาง; รีสตาร์ทแล้วยอดเป็น 0 ไม่เกิน 1 รอบ heartbeat
 * นับเฉพาะผู้ใช้ที่ล็อกอิน — request ทุกตัวมาจาก Next.js proxy แยก guest ด้วย IP ไม่ได้ และ id ที่ client สร้างเองปลอมได้
 */
export const HEARTBEAT_MS = 60_000;
export const ONLINE_WINDOW_MS = 2 * HEARTBEAT_MS + 15_000;

const lastSeen = new Map<string, number>();

export function recordHeartbeat(user_id: string, now = Date.now()) {
  lastSeen.set(user_id, now);
  // เก็บกวาดเป็นครั้งคราว กัน Map โตไม่จำกัด (1 key ต่อผู้ใช้ จึงโตช้า)
  if (lastSeen.size > 10_000) prune(now);
}

/** ปิดแท็บ/ออกจากหน้าอ่าน — เอาออกทันที ไม่ต้องรอหมดเวลา */
export function clearPresence(user_id: string) {
  lastSeen.delete(user_id);
}

export function onlineReaderCount(now: Date | number = Date.now()) {
  const t = typeof now === "number" ? now : now.getTime();
  prune(t);
  return lastSeen.size;
}

function prune(now: number) {
  for (const [id, at] of lastSeen) if (now - at > ONLINE_WINDOW_MS) lastSeen.delete(id);
}

/** สำหรับเทสต์ */
export function resetPresence() {
  lastSeen.clear();
}
