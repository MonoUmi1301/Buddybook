"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useCloudinaryUpload } from "@/lib/useCloudinaryUpload";
import { cn } from "@/lib/cn";

interface AddCharacterModalProps {
  onClose: () => void;
  onSubmit: (input: { name: string; avatarUrl?: string }) => Promise<void>;
}

// เพิ่มภายหลัง (audit fix) — สำหรับคนที่ยังไม่มีรูปตัวละครของตัวเองแต่อยากได้ avatar ไว้ก่อน
// (จะได้ลากโยงเส้นความสัมพันธ์บนแคนวาสให้ดูออกง่ายขึ้น ไม่ต้องรอมีรูปจริง) ใช้ i.pravatar.cc ซึ่ง
// whitelist ไว้ใน next.config.mjs remotePatterns อยู่แล้วแต่ยังไม่เคยมีจุดใช้งานจริงในโค้ด
const PRESET_AVATAR_IDS = [12, 5, 33, 47, 25, 60, 15, 68];
const presetAvatarUrl = (id: number) => `https://i.pravatar.cc/150?img=${id}`;

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
    } catch {
      setError("เพิ่มตัวละครไม่สำเร็จ ลองใหม่อีกครั้ง");
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
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploading} />
          </label>
        </div>
        {uploadError && <p className="mb-2 text-center text-xs text-red-500">{uploadError}</p>}

        <p className="mb-1.5 text-center text-xs text-neutral-400">หรือเลือกอวาตาร์ตัวอย่าง (เผื่อยังไม่มีรูปตัวละคร)</p>
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {PRESET_AVATAR_IDS.map((id) => {
            const url = presetAvatarUrl(id);
            const selected = avatarUrl === url;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setAvatarUrl(url)}
                aria-label={`เลือกอวาตาร์ตัวอย่าง ${id}`}
                className={cn(
                  "relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 transition-colors",
                  selected ? "ring-primary-500" : "ring-transparent hover:ring-neutral-300"
                )}
              >
                <Image src={url} alt="" fill sizes="40px" className="object-cover" />
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
          <Button type="button" variant="primary" onClick={handleSubmit} loading={submitting} disabled={uploading}>
            เพิ่มตัวละคร
          </Button>
        </div>
      </div>
    </div>
  );
}
