import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/lib/jwt";
import { ApiError } from "@/utils/ApiError";
import { env } from "@/config/env";
import { isUserSuspended } from "@/lib/suspension";

/** เทียบ secret แบบเวลาคงที่ (code audit L1) — timingSafeEqual throw ถ้าความยาวไม่เท่า จึงเช็คก่อน */
function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** 403 ที่เว็บใช้แยกกรณี "ต้องกรอกอีเมลก่อน" ออกจาก 403 อื่น (เช่นบัญชีถูกระงับ) */
export const EMAIL_REQUIRED_CODE = "EMAIL_REQUIRED";

function authenticate(allowMissingEmail: boolean) {
  return (req: Request, _res: Response, next: NextFunction) => {
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

    // บัญชี LINE ที่ยังไม่มีอีเมล — ใช้ได้แค่ endpoint กรอก/ยืนยันอีเมล (requireAuthAllowMissingEmail)
    if (payload.email_required && !allowMissingEmail) {
      throw ApiError.forbidden("กรุณากรอกและยืนยันอีเมลก่อนใช้งาน", { code: EMAIL_REQUIRED_CODE });
    }

    // เพิ่มภายหลัง (auth hardening) — บัญชีที่ถูกระงับใช้ access token ที่ออกไปแล้วต่อไม่ได้ (ดู lib/suspension.ts)
    isUserSuspended(payload.user_id)
      .then((isSuspended) => {
        if (isSuspended) return next(ApiError.forbidden("This account has been suspended"));
        req.user = { user_id: payload.user_id, role: payload.role };
        next();
      })
      .catch(next);
  };
}

/**
 * ตรวจ `Authorization: Bearer <access_token>` แล้วแนบ req.user
 * ใช้กับทุก endpoint ยกเว้นที่ทำเครื่องหมาย (Public) ใน API_Endpoints.md
 * token ที่มี email_required (บัญชียังไม่มีอีเมล) ได้ 403 EMAIL_REQUIRED
 */
// ตั้งชื่อฟังก์ชันให้ตรงกับชื่อ export — lib/openapi.ts อ่านระดับสิทธิ์จากชื่อ middleware
export const requireAuth = Object.defineProperty(authenticate(false), "name", { value: "requireAuth" });

/** เหมือน requireAuth แต่รับบัญชีที่ยังไม่มีอีเมล — ใช้กับ /auth/complete-profile/* เท่านั้น */
export const requireAuthAllowMissingEmail = Object.defineProperty(authenticate(true), "name", {
  value: "requireAuthAllowMissingEmail",
});

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
    // บัญชีที่ยังไม่มีอีเมลถือเป็น anonymous บน endpoint สาธารณะ (ใช้สิทธิ์ผู้ใช้ไม่ได้จนกว่าจะยืนยันอีเมล)
    if (payload && !payload.email_required) {
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
  if (!env.INTERNAL_SERVICE_TOKEN || typeof token !== "string" || !safeEqual(token, env.INTERNAL_SERVICE_TOKEN)) {
    throw ApiError.unauthorized("Invalid internal service token");
  }
  next();
}
