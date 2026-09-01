"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DonateModalProps {
  novelId: string;
  authorId: string;
  authorUsername: string;
  onClose: () => void;
}

/** ป๊อปอัพ "ให้ของขวัญ" — โอน coin จริงให้นักเขียน ต่อกับ POST /donations จริง
 *  (422 ถ้า coin ไม่พอ — ข้อความจาก donations.service.ts) */
export function DonateModal({ novelId, authorId, authorUsername, onClose }: DonateModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (amount < 1) {
      setError("กรุณาระบุจำนวน coin ที่ต้องการให้");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_user_id: authorId, novel_id: novelId, amount, message: message.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "ให้ของขวัญไม่สำเร็จ");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">ให้ของขวัญ {authorUsername}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-neutral-700">จำนวน coin</label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="h-11 w-full rounded-lg border border-neutral-300 px-4 text-sm focus:border-primary-400 focus:outline-none"
        />

        <label className="mb-1.5 mt-3 block text-sm font-medium text-neutral-700">ข้อความให้กำลังใจ (ไม่บังคับ)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
        />

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} loading={submitting}>
            ส่งของขวัญ
          </Button>
        </div>
      </div>
    </div>
  );
}
