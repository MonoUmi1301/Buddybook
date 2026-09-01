import crypto from "node:crypto";
import { env } from "@/config/env";

/** ใช้เช็คก่อนทุกครั้งก่อนเรียก signUpload — ฟีเจอร์ upload gate ตัวเองด้วยอันนี้แทนที่จะบังคับ
 *  ตอน boot (ต่างจาก NEO4J_* — ดู config/env.ts) เพื่อให้ dev คนอื่นรันระบบได้แม้ยังไม่ตั้งค่า Cloudinary */
export function isCloudinaryConfigured(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

interface SignUploadParams {
  folder: string;
}

/**
 * สร้าง signature สำหรับ signed direct upload จาก browser ไป Cloudinary ตรง ๆ (ไม่ผ่าน server
 * ของเรา — ตาม BuddyBook_System_Architecture.md ส่วน Storage) อัลกอริทึมตาม Cloudinary docs:
 * sort ชื่อพารามิเตอร์ที่จะเซ็นตามตัวอักษร ต่อเป็น key=value&key=value แล้วต่อท้ายด้วย api_secret
 * ดิบ ๆ (ไม่มี separator) แล้ว SHA-1 hash เป็น hex — ต้องตรงกับพารามิเตอร์ที่ frontend ส่งไปเป๊ะ ๆ
 */
export function signUpload({ folder }: SignUploadParams) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + env.CLOUDINARY_API_SECRET)
    .digest("hex");

  return {
    signature,
    timestamp,
    api_key: env.CLOUDINARY_API_KEY,
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    folder,
  };
}
