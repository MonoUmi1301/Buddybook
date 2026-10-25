import type { NextFunction, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";

/**
 * เพิ่มภายหลัง (Gift donations) — rate limit ต่อผู้ใช้ ใช้หลัง requireAuth เท่านั้น
 * หลาย route ใช้ bucket เดียวกันได้ด้วยการส่ง bucket ชื่อเดียวกัน (เช่น POST /gifts/send กับ
 * POST /donations นับรวมกัน)
 *
 * code audit L4 — ตัวนับอยู่ในตาราง rate_limits (fixed window ต่อ key) แทน memory ของ process เดิม
 * จึงนับรวมทุก instance ของ api และไม่รีเซ็ตเมื่อรีสตาร์ต — นับ+เช็คใน statement เดียว (upsert) ไม่มี race
 */
async function hit(key: string, windowMs: number): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowMs / 1000}) THEN 1
                   ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowMs / 1000}) THEN now()
                          ELSE rate_limits.window_start END
    RETURNING count`;
  return rows[0].count;
}

/** ล้างแถวที่หมดหน้าต่างไปนานแล้ว — เรียกจาก scheduler (key ของผู้ใช้/อีเมลที่ไม่กลับมาอีกจะไม่ค้างตลอดไป) */
export async function purgeExpiredRateLimits(olderThanMs = 24 * 60 * 60 * 1000) {
  const { count } = await prisma.rateLimit.deleteMany({ where: { window_start: { lt: new Date(Date.now() - olderThanMs) } } });
  return count;
}

export function rateLimitPerUser(options: { bucket: string; max: number | (() => number); windowMs: number }) {
  return rateLimitByKey({ ...options, key: (req) => req.user?.user_id });
}

/**
 * เพิ่มภายหลัง (auth hardening) — rate limit ตาม key ที่ดึงจาก request (เช่นอีเมลที่ถูกล็อกอิน) ใช้กับ
 * endpoint ที่ยังไม่มี req.user อย่าง login/OTP/ลืมรหัสผ่าน — ไม่ใช้ IP เพราะทุก request มาจาก Next.js
 * proxy (apps/web/src/lib/api/proxy.ts) IP เดียวกันหมด ถ้านับตาม IP ผู้โจมตีคนเดียวจะล็อกทุกคนได้
 * การนับตามบัญชีเป้าหมายกันเดารหัสผ่าน/ยิง OTP ใส่อีเมลเดียวซ้ำ ๆ ได้โดยไม่กระทบผู้ใช้คนอื่น
 * key เป็น undefined → ปล่อยผ่าน (ให้ zod ใน controller ตอบ 400 ตามปกติ)
 */
export function rateLimitByKey(options: {
  bucket: string;
  max: number | (() => number);
  windowMs: number;
  key: (req: Request) => string | undefined;
  message?: string;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const id = options.key(req);
    if (!id) return next();

    const max = typeof options.max === "function" ? options.max() : options.max;
    // key ยาวไม่เกินคอลัมน์ (อีเมลยาวผิดปกติ) — ตัดท้ายไว้ก่อน ให้ zod ใน controller เป็นคนตอบ 400
    const key = `${options.bucket}:${id}`.slice(0, 200);
    hit(key, options.windowMs)
      .then((count) => {
        if (count > max) next(ApiError.tooManyRequests(options.message ?? "ส่งถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"));
        else next();
      })
      .catch((err: unknown) => {
        // นับไม่ได้ (DB สะดุด) = ปล่อยผ่าน ไม่ให้ทุก request ล้มเพราะตัวนับ — endpoint ที่ป้องกันต้องใช้ DB อยู่แล้ว
        console.error(`rate limit check failed (${options.bucket}), allowing request:`, err);
        next();
      });
  };
}

/** ดึงค่า string จาก body แบบ normalize (trim + lowercase) — ใช้เป็น key ของ rateLimitByKey */
export function bodyField(field: string) {
  return (req: Request) => {
    const v = (req.body as Record<string, unknown> | undefined)?.[field];
    return typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined;
  };
}

/** ใช้ในเทสต์เท่านั้น */
export async function resetRateLimits() {
  await prisma.rateLimit.deleteMany({});
}
