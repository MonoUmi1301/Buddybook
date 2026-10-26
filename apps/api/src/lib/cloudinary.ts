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

/** ชนิดไฟล์ที่อัปโหลดได้ (code audit L2) — อยู่ในพารามิเตอร์ที่เซ็น จึงแก้ฝั่ง browser ไม่ได้
 *  ไม่มี svg (ฝังสคริปต์ได้) และ pdf ; heic/heif สำหรับรูปจาก iPhone */
export const ALLOWED_UPLOAD_FORMATS = "avif,gif,heic,heif,jpeg,jpg,png,webp";

/**
 * สร้าง signature สำหรับ signed direct upload จาก browser ไป Cloudinary ตรง ๆ (ไม่ผ่าน server
 * ของเรา — ตาม BuddyBook_System_Architecture.md ส่วน Storage) อัลกอริทึมตาม Cloudinary docs:
 * sort ชื่อพารามิเตอร์ที่จะเซ็นตามตัวอักษร ต่อเป็น key=value&key=value แล้วต่อท้ายด้วย api_secret
 * ดิบ ๆ (ไม่มี separator) แล้ว SHA-1 hash เป็น hex — ต้องตรงกับพารามิเตอร์ที่ frontend ส่งไปเป๊ะ ๆ
 */
export function signUpload({ folder }: SignUploadParams) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `allowed_formats=${ALLOWED_UPLOAD_FORMATS}&folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    // SHA-1 เป็นอัลกอริทึมที่ Cloudinary กำหนดให้ใช้เซ็น upload (ไม่ได้ใช้เก็บรหัสผ่าน) — เปลี่ยนเองฝั่งเดียวจะเซ็นไม่ผ่าน
    .createHash("sha1") // NOSONAR
    .update(paramsToSign + env.CLOUDINARY_API_SECRET)
    .digest("hex");

  return {
    signature,
    timestamp,
    api_key: env.CLOUDINARY_API_KEY,
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    folder,
    allowed_formats: ALLOWED_UPLOAD_FORMATS,
  };
}
