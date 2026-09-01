"use client";

import { useState } from "react";

export type UploadFolder = "covers" | "avatars" | "locations" | "slips" | "chapters";

interface SignResponse {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
}

/**
 * อัปโหลดรูปตรงจาก browser ไป Cloudinary (signed upload) — เซิร์ฟเวอร์ของเราแค่เซ็น signature
 * ให้ (POST /api/v1/uploads/sign) ไม่ผ่านไฟล์รูปเข้าเซิร์ฟเวอร์ตัวเองเลย ตาม
 * BuddyBook_System_Architecture.md ส่วน Storage
 */
export function useCloudinaryUpload(folder: UploadFolder) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<string | null> {
    setUploading(true);
    setError(null);
    try {
      const signRes = await fetch("/api/v1/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      const signData: SignResponse & { error?: string } = await signRes.json();
      if (!signRes.ok) {
        setError(signData.error ?? "เตรียมอัปโหลดไม่สำเร็จ");
        return null;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", signData.api_key);
      form.append("timestamp", String(signData.timestamp));
      form.append("signature", signData.signature);
      form.append("folder", signData.folder);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloud_name}/image/upload`, {
        method: "POST",
        body: form,
      });
      const uploadData: { secure_url?: string; error?: { message: string } } = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.secure_url) {
        setError(uploadData.error?.message ?? "อัปโหลดรูปไม่สำเร็จ");
        return null;
      }
      return uploadData.secure_url;
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, error };
}
