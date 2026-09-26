import { prisma } from "@/lib/prisma";

/**
 * เพิ่มภายหลัง (auth hardening) — cache รายชื่อ user_id ที่ถูกระงับ ใช้ใน requireAuth
 * เดิมเช็ค is_suspended แค่ตอน login/refresh ทำให้ผู้ใช้ที่ถูกระงับยังใช้ access token เดิมได้อีกถึง 15 นาที
 * แต่ก็ไม่อยาก query DB ทุก request — ผู้ใช้ที่ถูกระงับมีน้อยมาก จึงโหลดทั้งชุดมาเก็บใน memory แล้ว
 * refresh ทุก REFRESH_MS (query เดียวต่อรอบ ไม่ใช่ต่อ request) และอัปเดตทันทีตอนแอดมินกดระงับ/ยกเลิก
 * ถ้ารันหลาย instance ตัวอื่นจะรู้ช้าสุด REFRESH_MS
 */
const REFRESH_MS = 30_000;

let suspended = new Set<string>();
let loadedAt = 0;
let loading: Promise<void> | null = null;

async function reload() {
  const rows = await prisma.user.findMany({ where: { is_suspended: true }, select: { user_id: true } });
  suspended = new Set(rows.map((r) => r.user_id));
  loadedAt = Date.now();
}

export async function isUserSuspended(user_id: string): Promise<boolean> {
  if (Date.now() - loadedAt > REFRESH_MS) {
    loading ??= reload().finally(() => {
      loading = null;
    });
    await loading;
  }
  return suspended.has(user_id);
}

/** เรียกหลังแอดมินเปลี่ยนสถานะ — มีผลทันทีใน instance นี้ */
export function setUserSuspendedCache(user_id: string, isSuspended: boolean) {
  if (isSuspended) suspended.add(user_id);
  else suspended.delete(user_id);
}
