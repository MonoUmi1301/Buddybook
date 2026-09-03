"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Coins, Loader2, Sparkles, X } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CoinPackageRow, type CoinPackage } from "@/components/wallet/CoinPackageRow";
import { StripeCheckoutPanel } from "@/components/wallet/StripeCheckoutPanel";
import type { SessionUser } from "@/lib/api/session";

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

const BALANCE_POLL_INTERVAL_MS = 1000;
const BALANCE_POLL_MAX_ATTEMPTS = 6;

/** หน้าเติม coin — ต่อกับ GET /wallet/transactions + POST /wallet/topup/checkout-session จริงแล้ว
 *  (Stripe Embedded Checkout — ดู StripeCheckoutPanel.tsx และ wallet.service.ts ฝั่ง apps/api)
 *  ดู wf_empty_states.png */
export function WalletContent({ user, initialBalance }: WalletContentProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [selectedPkg, setSelectedPkg] = useState<CoinPackage | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [creditedCoins, setCreditedCoins] = useState<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // เพิ่มภายหลัง (audit fix) — Stripe redirect กลับมาที่นี่พร้อม checkout_session_id หลังจ่ายเงินเสร็จ
  // การเติมคอยน์จริงเกิดจาก webhook ฝั่ง server (อาจมาถึงก่อน/หลัง redirect นี้เล็กน้อย ไม่ได้เรียงลำดับ
  // กันเป๊ะ ๆ) จึง poll ยอด balance สั้น ๆ (ทุก 1 วิ สูงสุด 6 ครั้ง) แทนที่จะเชื่อ initialBalance ตรง ๆ
  // ให้ผู้ใช้เห็นยอดอัปเดตไวภายในไม่กี่วินาทีโดยไม่ต้องกด refresh เอง ตามที่ขอไว้
  useEffect(() => {
    const sessionId = searchParams.get("checkout_session_id");
    if (!sessionId) return;

    setConfirmingPayment(true);
    let attempts = 0;
    const startBalance = initialBalance;

    const poll = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch("/api/v1/wallet/transactions");
        if (res.ok) {
          const json = (await res.json()) as { balance: number };
          if (json.balance !== startBalance) {
            setBalance(json.balance);
            setCreditedCoins(json.balance - startBalance);
            setConfirmingPayment(false);
            clearInterval(poll);
            router.replace("/wallet");
            return;
          }
        }
      } catch {
        // เชื่อมต่อไม่สำเร็จรอบนี้ — ลองรอบถัดไป ไม่ต้องแจ้ง error ให้กวนใจ
      }
      if (attempts >= BALANCE_POLL_MAX_ATTEMPTS) {
        clearInterval(poll);
        setConfirmingPayment(false);
      }
    }, BALANCE_POLL_INTERVAL_MS);

    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ปิด popup "ชำระเงินสำเร็จ" เองหลัง 5 วิ เผื่อผู้ใช้ไม่กดปิด
  useEffect(() => {
    if (creditedCoins === null) return;
    const timer = setTimeout(() => setCreditedCoins(null), 5000);
    return () => clearTimeout(timer);
  }, [creditedCoins]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="flex-1">
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
                {confirmingPayment && <Loader2 className="h-4 w-4 animate-spin text-primary-500" />}
                🪙 {balance.toLocaleString()}
              </p>
              {confirmingPayment && <p className="text-xs text-primary-500">กำลังยืนยันการชำระเงิน...</p>}
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

      {creditedCoins !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setCreditedCoins(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-card bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setCreditedCoins(null)}
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
              onClick={() => setCreditedCoins(null)}
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
