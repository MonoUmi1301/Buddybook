import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/utils/ApiError";
import { env } from "@/config/env";

/**
 * Central error handler — ต้องเป็น middleware ตัวสุดท้ายที่ app.use() ใน app.ts
 * (Express รู้ว่าเป็น error handler จาก signature 4 arguments)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Unique constraint violation", fields: err.meta?.target });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Record not found" });
    }
  }

  // eslint-disable-next-line no-console
  console.error(err);

  return res.status(500).json({
    error: "Internal server error",
    ...(env.NODE_ENV === "development" && err instanceof Error ? { message: err.message, stack: err.stack } : {}),
  });
}
