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
