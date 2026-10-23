/**
 * gap 3.4 — ยืนยันอายุจากวันเกิดในบัญชี Google (Requirement ข้อ 4: "ดึงอายุมาจาก GG เพื่อยืนยันตัวตนแทนบัตรประชาชน")
 * แยกเป็น pure function เพื่อทดสอบได้โดยไม่ต้องเรียก Google จริง
 */

export interface BirthDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/** อายุเต็มปี ณ วันที่ now (นับวันเกิดตามปฏิทินจริง ไม่ใช่หาร 365.25 ซึ่งคลาดได้ช่วงวันเกิด) */
export function ageOn(birth: BirthDate, now = new Date()): number {
  let age = now.getFullYear() - birth.year;
  const m = now.getMonth() + 1;
  if (m < birth.month || (m === birth.month && now.getDate() < birth.day)) age -= 1;
  return age;
}

export const ADULT_AGE = 18;
/** อายุมากสุดที่ยอมรับตอนกรอกวันเกิดเอง — กันค่าอย่าง 0001-01-01 ที่เลือกมาแค่ให้ผ่าน */
export const MAX_DECLARED_AGE = 120;

/**
 * แปลงวันเกิดที่ผู้ใช้กรอกเอง — รับเฉพาะ YYYY-MM-DD ที่เป็นวันจริงในปฏิทิน ไม่อยู่ในอนาคต และอายุไม่เกิน
 * MAX_DECLARED_AGE (เดิมใช้ Date.parse ซึ่งยอมรับ "1" เป็นปี 2001 และ "0001-01-01" ได้ด้วย)
 */
export function parseBirthDate(value: string, now = new Date()): BirthDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const birth = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  const d = new Date(Date.UTC(birth.year, birth.month - 1, birth.day));
  if (d.getUTCFullYear() !== birth.year || d.getUTCMonth() + 1 !== birth.month || d.getUTCDate() !== birth.day) {
    return null; // เช่น 2001-02-30
  }
  const age = ageOn(birth, now);
  if (age < 0 || age > MAX_DECLARED_AGE) return null;
  return birth;
}

interface GooglePeopleBirthday {
  metadata?: { primary?: boolean; source?: { type?: string } };
  date?: { year?: number; month?: number; day?: number };
}

/**
 * เลือกวันเกิดจาก People API (`people/me?personFields=birthdays`) — ต้องมีปีด้วยถึงจะคำนวณอายุได้
 * ให้ความสำคัญกับค่าที่มาจากบัญชี (ACCOUNT) และ primary ก่อน ค่าที่ผู้ใช้ไม่ได้ใส่ปีถือว่าใช้ไม่ได้
 */
export function pickGoogleBirthday(people: { birthdays?: GooglePeopleBirthday[] } | null | undefined): BirthDate | null {
  const candidates = (people?.birthdays ?? []).filter(
    (b) => b.date?.year && b.date.month && b.date.day
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => score(b) - score(a));
  const d = candidates[0].date!;
  return { year: d.year!, month: d.month!, day: d.day! };
}

function score(b: GooglePeopleBirthday): number {
  return (b.metadata?.source?.type === "ACCOUNT" ? 2 : 0) + (b.metadata?.primary ? 1 : 0);
}
