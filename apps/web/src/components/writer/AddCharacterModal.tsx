"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ImageCropDialog } from "@/components/ui/image-crop-dialog";
import { useCloudinaryUpload } from "@/lib/useCloudinaryUpload";
import { cn } from "@/lib/cn";
import { errorText } from "@/lib/formatApiError";
import { handleAsync } from "@/lib/handleAsync";

interface AddCharacterModalProps {
  onClose: () => void;
  onSubmit: (input: { name: string; avatarUrl?: string }) => Promise<void>;
}

// อวาตาร์ตัวละครสำเร็จรูป (วาดเองสำหรับ BuddyBook) สำหรับคนที่ยังไม่มีรูปตัวละครของตัวเอง — ไฟล์อยู่ใน
// apps/web/public/characters/ เก็บลง DB เป็น path ในเว็บ (API รับ "/characters/*.png" ได้)
// เดิมใช้รูปคนจริงจาก i.pravatar.cc — เปลี่ยนเป็นภาพวาดของโปรเจกต์แทน (ผู้ใช้ขอ)
const PRESET_AVATARS = [
  { src: "/characters/top.png", label: "Top" },
  { src: "/characters/bottom.png", label: "Bottom" },
  { src: "/characters/seme.png", label: "Seme" },
  { src: "/characters/uke.png", label: "Uke" },
];

/** ป๊อปอัพเพิ่มตัวละคร — เดิม QuickAddPopover มีแค่ช่องกรอกชื่อ ไม่มีทางใส่รูป avatar เลย
 *  (CharacterNode.tsx รองรับ avatarUrl อยู่แล้วแต่ไม่มี UI ไหนตั้งค่าได้จริง) ใช้
 *  useCloudinaryUpload("avatars") แบบเดียวกับปกนิยายใน CreateNovelForm พร้อมอวาตาร์ตัวอย่างให้เลือก
 *  ทันทีสำหรับคนที่ยังไม่มีรูปตัวละครของตัวเอง */
export function AddCharacterModal({ onClose, onSubmit }: AddCharacterModalProps) {
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upload, uploading, error: uploadError } = useCloudinaryUpload("avatars");
  const [cropFile, setCropFile] = useState<File | null>(null);

  // เลือกไฟล์แล้วเปิดป๊อปอัปครอปก่อน (ขยับ/ซูม/หมุน) แล้วค่อยอัปโหลดรูปที่ครอปแล้ว
  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file?.type.startsWith("image/")) setCropFile(file);
  }

  async function handleAvatarChange(file: File) {
    setCropFile(null);
    const url = await upload(file);
    if (url) setAvatarUrl(url);
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("กรุณากรอกชื่อตัวละคร");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: trimmed, avatarUrl: avatarUrl ?? undefined });
      onClose();
    } catch (e) {
      setError(errorText(e, "เพิ่มตัวละครไม่สำเร็จ ลองใหม่อีกครั้ง"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">เพิ่มตัวละคร</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex justify-center">
          <label className="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-primary-400">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="avatar ตัวละคร" fill className="object-cover" />
            ) : uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            ) : (
              <Camera className="h-6 w-6 text-neutral-300" />
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} disabled={uploading} />
          </label>
        </div>
        {uploadError && <p className="mb-2 text-center text-xs text-red-500">{uploadError}</p>}
        {cropFile && (
          <ImageCropDialog
            file={cropFile}
            title="ปรับรูปตัวละคร"
            onCancel={() => setCropFile(null)}
            onConfirm={handleAsync(handleAvatarChange)}
          />
        )}

        <p className="mb-1.5 text-center text-xs text-neutral-400">หรือเลือกอวาตาร์ตัวอย่าง (เผื่อยังไม่มีรูปตัวละคร)</p>
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {PRESET_AVATARS.map(({ src, label }) => {
            const selected = avatarUrl === src;
            return (
              <button
                key={src}
                type="button"
                onClick={() => setAvatarUrl(src)}
                aria-label={`เลือกอวาตาร์ตัวอย่าง ${label}`}
                title={label}
                className={cn(
                  "relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 transition-colors",
                  selected ? "ring-primary-500" : "ring-transparent hover:ring-neutral-300"
                )}
              >
                <Image src={src} alt="" fill sizes="48px" className="object-cover" />
              </button>
            );
          })}
        </div>

        <Input
          label="ชื่อตัวละคร"
          placeholder="ชื่อตัวละคร"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" variant="primary" onClick={handleAsync(handleSubmit)} loading={submitting} disabled={uploading}>
            เพิ่มตัวละคร
          </Button>
        </div>
      </div>
    </div>
  );
}
