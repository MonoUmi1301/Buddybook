import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@/utils/ApiError";

/**
 * เพิ่มภายหลัง (Gift donations) — rate limit แบบ sliding window ต่อผู้ใช้ เก็บใน memory ของ process
 * (ยังไม่มี Redis) ถ้ารัน api หลาย instance ลิมิตจะเป็นต่อ instance — ใช้หลัง requireAuth เท่านั้น
 * หลาย route ใช้ bucket เดียวกันได้ด้วยการส่ง bucket ชื่อเดียวกัน (เช่น POST /gifts/send กับ
 * POST /donations นับรวมกัน)
 */
const buckets = new Map<string, number[]>();

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
    const key = `${options.bucket}:${id}`;
    const now = Date.now();
    const hits = (buckets.get(key) ?? []).filter((t) => now - t < options.windowMs);

    if (hits.length >= max) {
      buckets.set(key, hits);
      throw ApiError.tooManyRequests(options.message ?? "ส่งถี่เกินไป กรุณารอสักครู่แล้วลองใหม่");
    }

    hits.push(now);
    buckets.set(key, hits);

    // เก็บกวาด key ที่หมดอายุเป็นครั้งคราว กัน Map โตไม่จำกัด
    if (buckets.size > 10000) {
      for (const [k, times] of buckets) {
        if (times.every((t) => now - t >= options.windowMs)) buckets.delete(k);
      }
    }
    next();
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
export function resetRateLimits() {
  buckets.clear();
}
