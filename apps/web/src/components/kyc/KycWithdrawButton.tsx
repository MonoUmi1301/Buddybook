"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { formatApiError } from "@/lib/formatApiError";

/** ถอนความยินยอม e-KYC (PDPA) — ลบข้อมูลการยืนยันตัวตนที่ BuddyBook เก็บไว้ และยกเลิกอายุที่ได้จากบัตร */
export function KycWithdrawButton() {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleWithdraw() {
    const ok = await confirm({
      title: "ถอนความยินยอมและลบข้อมูลการยืนยันตัวตน?",
      message: "ระบบจะลบผลการยืนยันด้วยบัตรและวันเกิดที่ได้จากบัตร บัญชีนี้จะอ่านนิยายเรต 13+ และ 18+ ไม่ได้จนกว่าจะยืนยันอายุใหม่",
      confirmText: "ถอนความยินยอม",
      cancelText: "ยกเลิก",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/kyc", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(formatApiError(await res?.json().catch(() => null), "ลบข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleWithdraw}
        disabled={busy}
        className="text-sm text-neutral-500 underline hover:text-red-600 disabled:opacity-50"
      >
        ถอนความยินยอมและลบข้อมูลการยืนยันตัวตน
      </button>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {confirmDialog}
    </div>
  );
}
