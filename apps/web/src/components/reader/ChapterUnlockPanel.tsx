"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { useDialogA11y } from "@/hooks/use-dialog-a11y";
import { fetchBalance, formatCoins } from "@/lib/gifts";

interface ChapterUnlockPanelProps {
  chapterId: string;
  priceCoins: number;
  /** ตัวอย่างเนื้อหาแบบ plain text จาก API (teaser) — ว่างได้ถ้าตอนไม่มีเนื้อหา */
  teaser: string;
  isLoggedIn: boolean;
  /** เรียกพร้อมเนื้อหาที่ API ส่งกลับหลังซื้อสำเร็จ ให้หน้าอ่านแสดงเนื้อหาได้ทันทีโดยไม่โหลดหน้าใหม่ */
  onUnlocked: (content: string) => void;
}

interface PurchaseResponse {
  balance_after: number;
  already_owned: boolean;
  content: string | null;
}

/** เพิ่มภายหลัง (ตอนติดเหรียญ) — Paywall แสดงแทนเนื้อหาตอนที่ยังไม่ได้ซื้อ (API ส่ง content: null, locked: true)
 *  แสดงตัวอย่างเนื้อหา + ยอดคอยน์คงเหลือ กดปลดล็อกแล้วต้องยืนยันใน modal ก่อนตัดคอยน์จริง */
export function ChapterUnlockPanel({ chapterId, priceCoins, teaser, isLoggedIn, onUnlocked }: ChapterUnlockPanelProps) {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    fetchBalance().then((b) => {
      if (!cancelled) setBalance(b);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const missing = balance !== null ? Math.max(0, priceCoins - balance) : 0;

  async function unlock() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/chapters/${chapterId}/purchase`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as
        | (PurchaseResponse & { details?: { missing?: number; balance?: number } })
        | null;
      if (res.ok && json) {
        setBalance(json.balance_after);
        setConfirming(false);
        toast(json.already_owned ? "คุณปลดล็อกตอนนี้ไว้แล้ว" : "ปลดล็อกตอนนี้แล้ว");
        onUnlocked(json.content ?? "");
        // ให้ server component ดึงข้อมูลใหม่เบื้องหลัง (บันทึกการอ่าน/สารบัญ) — ไม่ใช่การโหลดหน้าใหม่
        router.refresh();
        return;
      }
      if (res.status === 422 && json?.details?.missing) {
        if (typeof json.details.balance === "number") setBalance(json.details.balance);
        setConfirming(false);
        return;
      }
      toast("ปลดล็อกไม่สำเร็จ กรุณาลองใหม่");
    } catch {
      toast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      {teaser && (
        <div className="relative max-h-40 overflow-hidden" aria-label="ตัวอย่างเนื้อหา">
          <p className="whitespace-pre-line leading-relaxed">{teaser}</p>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[var(--reader-bg,white)]" />
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-10 text-center text-neutral-800">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <Lock className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold">ตอนนี้เป็นตอนติดเหรียญ</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-neutral-600">
            ปลดล็อกด้วย <Coins className="h-4 w-4 text-amber-500" aria-hidden /> {formatCoins(priceCoins)} ซื้อครั้งเดียวอ่านได้ตลอด
          </p>
        </div>

        {!isLoggedIn ? (
          <Link href="/login" className="text-sm font-medium text-primary-600 hover:underline">
            เข้าสู่ระบบเพื่อปลดล็อก
          </Link>
        ) : (
          <>
            <p className="text-sm text-neutral-600">
              คอยน์คงเหลือ:{" "}
              <span className="font-semibold tabular-nums">{balance === null ? "..." : formatCoins(balance)}</span>
            </p>
            {missing > 0 ? (
              <div className="flex flex-col items-center gap-2 text-sm">
                <p className="text-red-600">คอยน์ไม่พอ ขาดอีก {formatCoins(missing)}</p>
                <Link href="/wallet" className="font-medium text-primary-600 hover:underline">
                  ไปเติมคอยน์
                </Link>
              </div>
            ) : (
              <Button onClick={() => setConfirming(true)} disabled={balance === null}>
                ใช้ {formatCoins(priceCoins)} เพื่อปลดล็อก
              </Button>
            )}
          </>
        )}
      </div>

      {confirming && balance !== null && (
        <ConfirmUnlockModal
          priceCoins={priceCoins}
          balance={balance}
          loading={loading}
          onConfirm={unlock}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

interface ConfirmUnlockModalProps {
  priceCoins: number;
  balance: number;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmUnlockModal({ priceCoins, balance, loading, onConfirm, onClose }: ConfirmUnlockModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose, !loading);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlock-dialog-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 text-left text-neutral-800 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="unlock-dialog-title" className="text-base font-semibold">
            ยืนยันการปลดล็อกตอน
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="ปิด"
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600">คอยน์คงเหลือ</dt>
            <dd className="tabular-nums">{formatCoins(balance)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">ราคาตอนนี้</dt>
            <dd className="tabular-nums text-red-600">-{formatCoins(priceCoins)}</dd>
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-2 font-semibold">
            <dt>คงเหลือหลังซื้อ</dt>
            <dd className="tabular-nums">{formatCoins(balance - priceCoins)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          <Button size="sm" onClick={onConfirm} loading={loading} data-autofocus>
            ยืนยัน ใช้ {formatCoins(priceCoins)}
          </Button>
        </div>
      </div>
    </div>
  );
}
