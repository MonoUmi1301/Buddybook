import type { Request, Response } from "express";
import { z } from "zod";
import { isCloudinaryConfigured, signUpload } from "@/lib/cloudinary";
import { ApiError } from "@/utils/ApiError";

// เพิ่มภายหลัง (audit fix) — "chapters" สำหรับรูปที่แทรกในเนื้อหาตอนนิยายผ่าน Quill image toolbar
// (เดิมไม่มี handler จริง ใช้พฤติกรรม default ของ Quill คือฝัง base64 ตรงใน content แทน ทำให้
// payload บวมจนชน express.json limit 2mb ได้ง่าย ๆ กับรูปแค่ 1-2 รูป)
const allowedFolders = ["covers", "avatars", "locations", "slips", "chapters"] as const;
const signBodySchema = z.object({ folder: z.enum(allowedFolders) });

/** Reference implementation — POST /uploads/sign (ส่วนขยายนอก API_Endpoints.md เดิม จำเป็นสำหรับ
 *  Cloudinary signed direct upload — ดู lib/cloudinary.ts) */
export async function sign(req: Request, res: Response) {
  if (!isCloudinaryConfigured()) {
    throw ApiError.badRequest(
      "Cloudinary is not configured — set CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET in apps/api/.env"
    );
  }

  const { folder } = signBodySchema.parse(req.body);
  const result = signUpload({ folder: `buddybook/${folder}` });
  res.status(200).json(result);
}
