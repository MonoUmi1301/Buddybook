"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatApiError } from "@/lib/formatApiError";

interface DeleteAccountModalProps {
  hasPassword: boolean;
  onClose: () => void;
}

/** เพิ่มภายหลัง (audit fix) — modal ยืนยันลบบัญชี ดีไซน์เดียวกับ PublishChoiceModal.tsx
 *  บังคับกรอกรหัสผ่านซ้ำเฉพาะบัญชีที่ตั้งรหัสผ่านไว้ (ไม่ใช่ OAuth-only) กันสั่งลบบัญชีโดยไม่ตั้งใจ/
 *  ไม่ได้รับอนุญาตจริง (เช่น session หลุด) — สำเร็จแล้ว reload เต็มหน้าไปที่ "/" เพราะ cookie
 *  ถูกเคลียร์ฝั่ง server แล้ว ต้องรีเซ็ต client state ทั้งหมดให้ตรงกับสถานะ guest จริง ๆ */
export function DeleteAccountModal({ hasPassword, onClose }: DeleteAccountModalProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmValid = confirmText.trim() === "ลบบัญชี";

  async function handleConfirm() {
    if (!confirmValid) {
      setError('กรุณาพิมพ์ "ลบบัญชี" ให้ตรงเพื่อยืนยัน');
      return;
    }
    if (hasPassword && !password) {
      setError("กรุณากรอกรหัสผ่านเพื่อยืนยัน");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/users/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hasPassword ? { password } : {}),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(formatApiError(json, "ลบบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        setSubmitting(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-h3 text-red-600">
            <TriangleAlert className="h-5 w-5" />
            ลบบัญชีถาวร
          </h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-neutral-600">
          <li>เข้าสู่ระบบด้วยบัญชีนี้อีกไม่ได้อีกเลย</li>
          <li>ชื่อผู้ใช้ อีเมล รูปโปรไฟล์ และประวัติส่วนตัวจะถูกลบทั้งหมด</li>
          <li>นิยาย รีวิว คอมเมนต์ที่เคยลงไว้จะแสดงเป็น &ldquo;ผู้ใช้ที่ถูกลบ&rdquo; แทน (ไม่หายไปจากระบบ)</li>
          <li>ย้อนกลับไม่ได้</li>
        </ul>

        {hasPassword && (
          <div className="mb-3">
            <Input
              type="password"
              placeholder="รหัสผ่านปัจจุบัน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        )}

        <div className="mb-1">
          <Input
            placeholder='พิมพ์ "ลบบัญชี" เพื่อยืนยัน'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            type="button"
            variant="primary"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleConfirm}
            loading={submitting}
            disabled={!confirmValid}
          >
            ลบบัญชีถาวร
          </Button>
        </div>
      </div>
    </div>
  );
}
