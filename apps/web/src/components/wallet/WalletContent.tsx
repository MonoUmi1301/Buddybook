"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Coins, Loader2, Sparkles, X, XCircle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CoinPackageRow, type CoinPackage } from "@/components/wallet/CoinPackageRow";
import { StripeCheckoutPanel } from "@/components/wallet/StripeCheckoutPanel";
import { GiftDraftBanner } from "@/components/gifts/GiftDraftBanner";
import type { SessionUser } from "@/lib/api/session";
import { usePaymentResult, type PaymentOutcome } from "@/hooks/use-payment-result";

const packages: CoinPackage[] = [
  { id: "p25", coins: 25, priceLabel: "25 บาท" },
  { id: "p50", coins: 50, priceLabel: "50 บาท" },
  { id: "p100", coins: 100, priceLabel: "99 บาท" },
  { id: "p259", coins: 259, priceLabel: "250 บาท" },
  { id: "p410", coins: 410, priceLabel: "400 บาท" },
  { id: "p825", coins: 825, priceLabel: "800 บาท" },
];

interface WalletContentProps {
  user: SessionUser;
  initialBalance: number;
}

/** หน้าเติม coin — ต่อกับ GET /wallet/transactions + POST /wallet/topup/checkout-session จริงแล้ว
 *  (Stripe Embedded Checkout — ดู StripeCheckoutPanel.tsx และ wallet.service.ts ฝั่ง apps/api)
 *  ดู wf_empty_states.png */
export function WalletContent({ user, initialBalance }: WalletContentProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [selectedPkg, setSelectedPkg] = useState<CoinPackage | null>(null);
  // modal ผลลัพธ์เป็น state ของตัวเอง — ถูกตั้งค่าจาก onOutcome ของ usePaymentResult "ครั้งเดียว" ต่อ order
  // ไม่ derive จากสถานะ (ไม่มี open = status === "PAID") และไม่มี effect ที่เปิดซ้ำตามสถานะ
  const [result, setResult] = useState<PaymentOutcome | null>(null);
  const [spinnerDismissed, setSpinnerDismissed] = useState(false);
  const searchParams = useSearchParams();
  const balanceRefetchedRef = useRef(false);

  // return_url ของ Stripe พา ?topup_order=<order_id> กลับมา — ตัวเช็คสถานะตัวเดียวของระบบอยู่ในนี้
  const { checking } = usePaymentResult(searchParams.get("topup_order"), (outcome) => {
    balanceRefetchedRef.current = false;
    setResult(outcome);
  });

  /** ปิด modal = ดึงยอด coin ใหม่ "ครั้งเดียว" แล้วจบ flow ของ order นี้ (ไม่เริ่ม poll ซ้ำ) */
  function closeResult() {
    setResult(null);
    if (balanceRefetchedRef.current) return;
    balanceRefetchedRef.current = true;
    fetch("/api/v1/wallet/transactions", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ balance: number }>) : null))
      .then((json) => {
        if (json) setBalance(json.balance);
      })
      .catch(() => undefined);
  }

  // ปิด popup "ชำระเงินสำเร็จ" เองหลัง 5 วิ เผื่อผู้ใช้ไม่กดปิด (ผ่าน closeResult เหมือนกดปิดเอง)
  useEffect(() => {
    if (result?.kind !== "paid") return;
    const timer = setTimeout(closeResult, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตั้งเวลาเฉพาะตอน modal สำเร็จเปิด
  }, [result]);

  const creditedCoins = result?.kind === "paid" ? result.coins : null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="flex-1">
        <GiftDraftBanner />
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-6">
            <div className="flex items-center gap-3">
              <Coins className="h-9 w-9 text-amber-400" />
              <div>
                <h1 className="text-h3 text-neutral-900">เติม coin เข้าระบบ</h1>
                <p className="text-sm text-neutral-500">จ่ายด้วยบัตร ยืนยันอัตโนมัติภายในไม่กี่วินาที</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-500">coin ของฉัน</p>
              <p className="flex items-center justify-end gap-1 text-xl font-bold text-neutral-900">
                {balance.toLocaleString()} <span className="text-sm font-medium text-neutral-500">coin</span>
              </p>
            </div>
          </div>

          <div className="mt-2">
            {packages.map((pkg) => (
              <CoinPackageRow key={pkg.id} pkg={pkg} onBuy={() => setSelectedPkg(pkg)} />
            ))}
          </div>
        </div>

        <div className="bg-brand-tan/20 px-4 py-6">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <Sparkles className="h-10 w-10 shrink-0 text-brand-tan-dark" />
            <p className="text-lg font-bold text-brand-brown">ยิ่งเติมเยอะ coin ยิ่งถูกลง!</p>
          </div>
        </div>
      </main>

      {selectedPkg && <StripeCheckoutPanel pkg={selectedPkg} onClose={() => setSelectedPkg(null)} />}

      {checking && !spinnerDismissed && result === null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSpinnerDismissed(true)}
        >
          <div
            className="relative w-full max-w-sm rounded-card bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSpinnerDismissed(true)}
              aria-label="ปิด"
              className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-5 w-5" />
            </button>
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-primary-500" />
            <h2 className="mt-4 text-h3 text-neutral-900">กำลังตรวจสอบการชำระเงิน...</h2>
            <p className="mt-2 text-neutral-600">กรุณารอสักครู่ ระบบกำลังยืนยันการชำระเงินของคุณ</p>
          </div>
        </div>
      )}

      {result?.kind === "pending-timeout" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeResult}
        >
          <div
            className="relative w-full max-w-sm rounded-card bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeResult}
              aria-label="ปิด"
              className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-5 w-5" />
            </button>
            <AlertCircle className="mx-auto h-14 w-14 text-amber-500" />
            <h2 className="mt-4 text-h3 text-neutral-900">รอยืนยันการชำระเงิน</h2>
            <p className="mt-2 text-neutral-600">coin จะเข้าเมื่อยืนยันแล้ว</p>
            <button
              type="button"
              onClick={closeResult}
              className="mt-6 w-full rounded-button bg-primary-500 py-2.5 font-bold text-white hover:bg-primary-600"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {result?.kind === "failed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeResult}
        >
          <div
            className="relative w-full max-w-sm rounded-card bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeResult}
              aria-label="ปิด"
              className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-5 w-5" />
            </button>
            <XCircle className="mx-auto h-14 w-14 text-red-500" />
            <h2 className="mt-4 text-h3 text-neutral-900">ทำรายการไม่สำเร็จ</h2>
            <p className="mt-2 text-neutral-600">
              รายการนี้หมดอายุหรือไม่ได้ชำระเงิน จึงยังไม่มี coin เข้าบัญชี กรุณาลองทำรายการใหม่อีกครั้ง
            </p>
            <button
              type="button"
              onClick={closeResult}
              className="mt-6 w-full rounded-button bg-primary-500 py-2.5 font-bold text-white hover:bg-primary-600"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {creditedCoins !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeResult}
        >
          <div
            className="relative w-full max-w-sm rounded-card bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeResult}
              aria-label="ปิด"
              className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-5 w-5" />
            </button>
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
            <h2 className="mt-4 text-h3 text-neutral-900">ชำระเงินสำเร็จ!</h2>
            <p className="mt-2 text-neutral-600">
              ได้รับ <span className="font-bold text-primary-500">{creditedCoins.toLocaleString()} coin</span> เข้าบัญชีแล้ว
            </p>
            <button
              type="button"
              onClick={closeResult}
              className="mt-6 w-full rounded-button bg-primary-500 py-2.5 font-bold text-white hover:bg-primary-600"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
