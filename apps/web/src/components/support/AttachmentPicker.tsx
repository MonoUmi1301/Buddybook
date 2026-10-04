"use client";

import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { useCloudinaryUpload } from "@/lib/useCloudinaryUpload";

/** แนบรูปหน้าจอ/สลิป 1 รูป (อัปโหลดผ่าน Cloudinary signed upload เหมือนรูปอื่นในระบบ) */
export function AttachmentPicker({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const { upload, uploading, error } = useCloudinaryUpload("support");

  if (value) {
    return (
      <div className="relative inline-block">
        <Image src={value} alt="รูปที่แนบ" width={96} height={96} className="h-24 w-24 rounded-lg border border-neutral-200 object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="เอารูปออก"
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <div>
      <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-pill border border-dashed border-neutral-300 px-3 text-sm text-neutral-600 hover:border-neutral-400">
        <ImagePlus className="h-4 w-4" /> {uploading ? "กำลังอัปโหลด..." : "แนบรูปหน้าจอ (ถ้ามี)"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = await upload(file);
            if (url) onChange(url);
            e.target.value = "";
          }}
        />
      </label>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
