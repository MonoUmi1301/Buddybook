import { prisma } from "@/lib/prisma";

/**
 * gap 3.1 — นับยอดเปิดอ่านตอน (เดิมไม่มีที่ไหนเพิ่ม novels.view_count เลย ยอดวิวจึงค้างตามค่า seed)
 * - นับเฉพาะผู้อ่านที่ไม่ใช่เจ้าของ และตอนที่อ่านได้จริง (เผยแพร่แล้ว/ปลดล็อกแล้ว) — ผู้เรียกเป็นคนเช็ค
 * - ผู้ชมคนเดิม (user_id หรือ IP) ต่อตอนนับแค่วันละครั้ง กันกดรีเฟรชปั่นยอด — เก็บในหน่วยความจำของ process
 *   (รีสตาร์ท/หลาย instance อาจนับซ้ำได้เล็กน้อย ยอมรับได้สำหรับสถิติ ไม่ใช่ข้อมูลการเงิน)
 * - "วัน" ใช้เวลาประเทศไทย ให้ตรงกับที่นักเขียนเห็นบนกราฟ
 */
const MAX_SEEN = 50_000;
const seen = new Set<string>();

export function thaiDay(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export async function recordChapterView(chapter_id: string, novel_id: string, viewer_key: string, now = new Date()) {
  const day = thaiDay(now);
  const key = `${viewer_key}|${chapter_id}|${day}`;
  if (seen.has(key)) return false;
  if (seen.size >= MAX_SEEN) seen.clear();
  seen.add(key);

  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO chapter_view_daily (chapter_id, novel_id, day, views)
      VALUES (${chapter_id}::uuid, ${novel_id}::uuid, ${day}::date, 1)
      ON CONFLICT (chapter_id, day) DO UPDATE SET views = chapter_view_daily.views + 1`,
    prisma.$executeRaw`UPDATE novels SET view_count = view_count + 1 WHERE novel_id = ${novel_id}::uuid`,
  ]);
  return true;
}

/** สำหรับเทสต์เท่านั้น */
export function resetViewDedupe() {
  seen.clear();
}
