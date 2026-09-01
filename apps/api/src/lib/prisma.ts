import { PrismaClient } from "@prisma/client";
import { env } from "@/config/env";

/**
 * Prisma Client singleton — กัน hot-reload (tsx watch) สร้าง connection pool
 * ใหม่ซ้ำ ๆ จนหลุด connection limit ของ PostgreSQL
 * อ้างอิง pattern มาตรฐานจาก Prisma docs
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
