/** เพิ่มภายหลัง (BRIEF: Navbar Global Mode) — ตั้งใจแยกออกมาเป็นไฟล์เปล่า (ไม่มี "use client")
 *  เพราะเดิม export ค่านี้จาก Navbar.tsx ตรง ๆ แล้ว import เข้า Server Component (app/page.tsx,
 *  search/page.tsx) — ค่าที่ได้กลับกลายเป็น undefined เสมอตอน runtime (cookies().get(undefined)
 *  หาไม่เจอ) เพราะ Next.js ทำ Client Reference ให้ export ทุกตัวของไฟล์ที่มี "use client" ไม่ใช่แค่
 *  React component เท่านั้น ค่าคงที่ธรรมดาข้าม server/client boundary แบบนั้นไม่ได้ */
export const WORK_TYPE_COOKIE = "bb_work_type";
export type WorkType = "original" | "fan-fiction";

export function asWorkType(value: string | undefined | null): WorkType | undefined {
  return value === "original" || value === "fan-fiction" ? value : undefined;
}

/** เพิ่มภายหลัง — โหมดเริ่มต้นเมื่อผู้ใช้ยังไม่เคยเลือก (ไม่มี cookie): "นิยาย" เสมอ ทั้งแท็บที่ไฮไลต์ใน Navbar
 *  และเนื้อหาหน้าแรก ต้องใช้ค่าเดียวกันผ่าน resolveWorkType() ไม่งั้นแท็บที่เลือกกับเนื้อหาจะไม่ตรงกัน */
export const DEFAULT_WORK_TYPE: WorkType = "original";

export function resolveWorkType(value: string | undefined | null): WorkType {
  return asWorkType(value) ?? DEFAULT_WORK_TYPE;
}
