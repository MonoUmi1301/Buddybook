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
  return (req: Request, _res: Response, next: NextFunction) => {
    const user_id = req.user?.user_id;
    if (!user_id) return next();

    const max = typeof options.max === "function" ? options.max() : options.max;
    const key = `${options.bucket}:${user_id}`;
    const now = Date.now();
    const hits = (buckets.get(key) ?? []).filter((t) => now - t < options.windowMs);

    if (hits.length >= max) {
      buckets.set(key, hits);
      throw ApiError.tooManyRequests("ส่งถี่เกินไป กรุณารอสักครู่แล้วลองใหม่");
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

/** ใช้ในเทสต์เท่านั้น */
export function resetRateLimits() {
  buckets.clear();
}
