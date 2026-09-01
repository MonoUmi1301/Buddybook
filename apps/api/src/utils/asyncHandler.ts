import type { NextFunction, Request, Response } from "express";

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * ห่อ async controller เพื่อส่ง error (rejected promise) เข้า
 * error.middleware.ts อัตโนมัติ แทนที่ต้อง try/catch ทุกฟังก์ชัน
 */
export const asyncHandler =
  (fn: AsyncRouteHandler) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
