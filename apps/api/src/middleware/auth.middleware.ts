import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/lib/jwt";
import { ApiError } from "@/utils/ApiError";
import { env } from "@/config/env";

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

  try {
    const payload = verifyAccessToken(token);
    req.user = { user_id: payload.user_id, role: payload.role };
    next();
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }
}

/**
 * เหมือน requireAuth แต่ไม่ throw ถ้าไม่มี/หมดอายุ token — ใช้กับ endpoint (Public)
 * ที่อยาก personalize ผลลัพธ์ให้เจ้าของเนื้อหา (เช่น เห็น draft chapters ของตัวเอง)
 */
export function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(header.slice("Bearer ".length));
      req.user = { user_id: payload.user_id, role: payload.role };
    } catch {
      // ไม่มี user ที่ถูกต้อง — ปล่อยผ่านเป็น anonymous request
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
