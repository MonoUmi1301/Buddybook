import type { UserRole } from "@prisma/client";

// ขยาย Express.Request ให้มี req.user หลังผ่าน auth.middleware.ts
declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        role: UserRole;
      };
    }
  }
}

export {};
