import type { Request, Response } from "express";

/**
 * Placeholder controller สำหรับ endpoint ที่ยังไม่ได้ใส่ business logic
 * (ตาม scope "skeleton ที่รันได้ ยังไม่มี business logic" ของรอบนี้)
 *
 * `label` ควรตรงกับแถวใน API_Endpoints.md เช่น "POST /novels" เพื่อให้ตามรอยง่าย
 * เมื่อจะ implement จริง ให้แทนที่ route นี้ด้วย controller ในไฟล์ .controller.ts
 * ตาม pattern ของ modules/auth หรือ modules/novels
 */
export const notImplemented = (label: string) => (_req: Request, res: Response) => {
  res.status(501).json({
    error: "Not implemented",
    endpoint: label,
    hint: "ดู API_Endpoints.md สำหรับ request/response shape ที่ตกลงกันไว้",
  });
};
