"use client";

import { useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCloudinaryUpload } from "@/lib/useCloudinaryUpload";
import type { CoinPackage } from "@/components/wallet/CoinPackageRow";

interface SlipUploadPanelProps {
  pkg: CoinPackage;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

/**
 * แผงอัปโหลดสลิปหลังเลือกแพ็กเกจ — อัปโหลดรูปสลิปไป Cloudinary ก่อน แล้วส่ง URL ให้ backend
 * ยิงต่อไป SlipOK จริง (ตรวจกับธนาคารผู้ออกสลิป ไม่ใช่แค่เชื่อรูป) ดู apps/api/src/lib/slipok.ts
 */
export function SlipUploadPanel({ pkg, onClose, onSuccess }: SlipUploadPanelProps) {
  const { upload, uploading } = useCloudinaryUpload("slips");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));

    const slipImageUrl = await upload(file);
    if (!slipImageUrl) {
      setError("อัปโหลดรูปสลิปไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/v1/wallet/topup/verify-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: pkg.id, slip_image_url: slipImageUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "ตรวจสอบสลิปไม่สำเร็จ");
        return;
      }
      onSuccess(Number(json.balance_after));
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setVerifying(false);
    }
  }

  const busy = uploading || verifying;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">
            เติม {pkg.coins} coin ({pkg.priceLabel})
          </h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-neutral-500">
          โอนเงินตามยอด {pkg.priceLabel} แล้วอัปโหลดสลิปโอนเงินเพื่อยืนยันอัตโนมัติ
        </p>

        <label className="group relative flex h-40 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-primary-400">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="สลิปโอนเงิน" className="h-full w-full object-contain" />
          ) : (
            <Camera className="h-6 w-6 text-neutral-300" />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={busy} />
        </label>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
        </div>
      </div>
    </div>
  );
}
