import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/lib/jwt";
import { ApiError } from "@/utils/ApiError";
import { env } from "@/config/env";
import { isUserSuspended } from "@/lib/suspension";

/**
 * ตรวจ `Authorization: Bearer <access_token>` แล้วแนบ req.user
 * ใช้กับทุก endpoint ยกเว้นที่ทำเครื่องหมาย (Public) ใน API_Endpoints.md
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing bearer token");
  }

  const token = header.slice("Bearer ".length);

  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  // เพิ่มภายหลัง (auth hardening) — บัญชีที่ถูกระงับใช้ access token ที่ออกไปแล้วต่อไม่ได้ (ดู lib/suspension.ts)
  isUserSuspended(payload.user_id)
    .then((isSuspended) => {
      if (isSuspended) return next(ApiError.forbidden("This account has been suspended"));
      req.user = { user_id: payload.user_id, role: payload.role };
      next();
    })
    .catch(next);
}

/**
 * เหมือน requireAuth แต่ไม่ throw ถ้าไม่มี/หมดอายุ token — ใช้กับ endpoint (Public)
 * ที่อยาก personalize ผลลัพธ์ให้เจ้าของเนื้อหา (เช่น เห็น draft chapters ของตัวเอง)
 */
export function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    let payload: ReturnType<typeof verifyAccessToken> | null = null;
    try {
      payload = verifyAccessToken(header.slice("Bearer ".length));
    } catch {
      // ไม่มี user ที่ถูกต้อง — ปล่อยผ่านเป็น anonymous request
    }
    if (payload) {
      const { user_id, role } = payload;
      // บัญชีที่ถูกระงับ → ปฏิบัติเหมือน anonymous
      isUserSuspended(user_id)
        .then((isSuspended) => {
          if (!isSuspended) req.user = { user_id, role };
          next();
        })
        .catch(next);
      return;
    }
  }
  next();
}

/**
 * ต้องเรียกต่อจาก requireAuth เสมอ (ต้องมี req.user ก่อน)
 * ใช้กับ endpoint กลุ่ม /admin/* ตาม API_Endpoints.md
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    throw ApiError.forbidden("Admin role required");
  }
  next();
}

/**
 * ใช้กับ endpoint กลุ่ม /internal/* (Python NLP Worker / Cron Scheduler)
 * ตรวจ shared secret แทน JWT ผู้ใช้ทั่วไป
 */
export function requireInternalService(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers["x-internal-token"];
  if (!env.INTERNAL_SERVICE_TOKEN || token !== env.INTERNAL_SERVICE_TOKEN) {
    throw ApiError.unauthorized("Invalid internal service token");
  }
  next();
}
