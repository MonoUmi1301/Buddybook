"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import {
  LOCATION_ICONS,
  LOCATION_ICON_KEYS,
  MapAssetIcon,
  isCustomLocationImage,
  type LocationIconKey,
} from "@/components/writer/mapAssets";
import { errorText } from "@/lib/formatApiError";
import { useCloudinaryUpload } from "@/lib/useCloudinaryUpload";
import { handleAsync } from "@/lib/handleAsync";

interface AddLocationModalProps {
  onClose: () => void;
  onSubmit: (input: { name: string; icon: LocationIconKey; category?: string }) => Promise<void>;
}

const CATEGORY_OPTIONS = ["ที่พักอาศัย", "ธรรมชาติ", "อันตราย", "ศักดิ์สิทธิ์"];
const MAX_UPLOAD_MB = 5;

/** ป๊อปอัพเพิ่มสถานที่ — เลือกภาพวาดสถานที่ของระบบ หรืออัปโหลดรูปของตัวเอง (เก็บ URL ไว้ใน map_icon_url)
 *  รูปที่อัปโหลดเป็น PNG พื้นหลังโปร่งใสจะเข้ากับแผนที่ที่สุด */
export function AddLocationModal({ onClose, onSubmit }: AddLocationModalProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<LocationIconKey>("castle");
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error: uploadError } = useCloudinaryUpload("locations");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("ไฟล์ต้องเป็นรูปภาพ (PNG, JPG, WEBP)");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`รูปต้องมีขนาดไม่เกิน ${MAX_UPLOAD_MB} MB`);
      return;
    }
    setError(null);
    const url = await upload(file);
    if (url) {
      setCustomUrl(url);
      setIcon(url);
    }
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("กรุณากรอกชื่อสถานที่");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: trimmed, icon, category: category ?? undefined });
      onClose();
    } catch (e) {
      setError(errorText(e, "เพิ่มสถานที่ไม่สำเร็จ ลองใหม่อีกครั้ง"));
    } finally {
      setSubmitting(false);
    }
  }

  const customSelected = isCustomLocationImage(icon);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">เพิ่มสถานที่</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <p className="mb-1.5 text-xs font-medium text-neutral-500">ภาพสถานที่</p>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {/* อัปโหลดรูปเอง */}
            <button
              type="button"
              onClick={() => (customUrl ? setIcon(customUrl) : fileRef.current?.click())}
              disabled={uploading}
              title="อัปโหลดรูปของคุณเอง"
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-2 transition-colors",
                customSelected ? "border-primary-500 bg-primary-50" : "border-neutral-300 hover:border-primary-400"
              )}
            >
              {uploading ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
              ) : customUrl ? (
                <MapAssetIcon asset={{ label: "รูปที่อัปโหลด", src: customUrl }} size={40} />
              ) : (
                <ImagePlus className="h-10 w-10 text-neutral-400" />
              )}
              <span className="text-[10px] text-neutral-500">
                {uploading ? "กำลังอัปโหลด" : customUrl ? "รูปของฉัน" : "อัปโหลดรูป"}
              </span>
            </button>

            {LOCATION_ICON_KEYS.map((key) => {
              const asset = LOCATION_ICONS[key];
              const selected = icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  title={asset.label}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors",
                    selected ? "border-primary-500 bg-primary-50" : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <MapAssetIcon asset={asset} size={40} />
                  <span className="line-clamp-1 text-[10px] text-neutral-500">{asset.label}</span>
                </button>
              );
            })}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {customUrl && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="-mt-2 mb-2 block text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
            >
              เปลี่ยนรูปที่อัปโหลด
            </button>
          )}
          <p className="mb-4 text-[11px] text-neutral-400">
            อัปโหลดรูปเองได้ไม่เกิน {MAX_UPLOAD_MB} MB — แนะนำ PNG พื้นหลังโปร่งใส จะกลืนกับแผนที่ที่สุด
          </p>

          <Input
            label="ชื่อสถานที่"
            placeholder="เช่น ปราสาทสีขาว"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <p className="mb-1.5 mt-3 text-xs font-medium text-neutral-500">หมวดหมู่ (ถ้ามี)</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(category === c ? null : c)}
                className={cn(
                  "rounded-pill border px-3 py-1 text-xs font-medium transition-colors",
                  category === c ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {(error || uploadError) && <p className="mt-3 text-sm text-red-500">{error ?? uploadError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" variant="primary" onClick={handleAsync(handleSubmit)} loading={submitting} disabled={uploading}>
            เพิ่มสถานที่
          </Button>
        </div>
      </div>
    </div>
  );
}
