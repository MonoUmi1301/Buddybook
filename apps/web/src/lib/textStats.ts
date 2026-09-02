// เพิ่มภายหลัง (audit fix) — นับความยาวเนื้อหาแบบเดียวกับฝั่ง backend (apps/api/src/modules/
// chapters/chapters.service.ts computeWordCount) เพื่อให้ตัวเลขที่โชว์สดตอนพิมพ์ตรงกับที่บันทึกจริง
// ไม่มี shared package ระหว่าง apps/api กับ apps/web ในโปรเจกต์นี้ (ดู passwordSchema ที่ก็ต้อง
// duplicate สองฝั่งเหมือนกัน) จึงต้องคัดลอกลอจิกไว้ที่นี่ ต้องแก้คู่กันเสมอถ้าจะเปลี่ยนวิธีนับ
//
// นับเป็น "ตัวอักษร" ไม่ใช่ "คำ" — ภาษาไทยไม่มีช่องว่างระหว่างคำแบบภาษาอังกฤษ split-by-space
// นับคำไม่ได้ผล
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

export function countCharacters(html?: string | null): number {
  if (!html) return 0;
  return stripHtml(html).replace(/\s+/g, "").length;
}

// ไม่มีมาตรฐาน "ตัวอักษรต่อหน้า" ในระบบนี้มาก่อน — ใช้ค่าประมาณเพื่อแสดงผลเท่านั้น
// (ไม่ใช่การคำนวณเลย์เอาต์พิมพ์จริงจากฟีเจอร์พรีวิวก่อนพิมพ์)
export const CHARACTERS_PER_PAGE = 1000;

export function estimatePageCount(characters: number): number {
  return Math.ceil(characters / CHARACTERS_PER_PAGE);
}
