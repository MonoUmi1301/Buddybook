"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Coins, Loader2, Sparkles, X, XCircle } from "lucide-react";
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
const PENDING_TOPUP_STORAGE_KEY = "bb_pending_topup";
// ไม่ตัดสิน "ไม่สำเร็จ" เองฝั่งเว็บ — ยึดตามสถานะจริงจาก Stripe เท่านั้น (session หมดอายุจริงที่ 30 นาที
// ตามที่ตั้งไว้ใน wallet.service.ts) ค่านี้ใช้แค่ล้าง localStorage entry เก่าค้างทิ้งไว้ (garbage
// collection เฉย ๆ ไม่ใช่การตัดสินว่ารายการล้มเหลว) ให้กว้างกว่า 30 นาทีของ Stripe พอสมควร
const STALE_PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface PendingTopup {
  sessionId: string;
  startedAt: number;
}

function readPendingTopup(): PendingTopup | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_TOPUP_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingTopup>;
    if (!parsed.sessionId || !parsed.startedAt) return null;
    return { sessionId: parsed.sessionId, startedAt: parsed.startedAt };
  } catch {
    return null;
  }
}

function clearPendingTopup() {
  try {
    localStorage.removeItem(PENDING_TOPUP_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** หน้าเติม coin — ต่อกับ GET /wallet/transactions + POST /wallet/topup/checkout-session จริงแล้ว
 *  (Stripe Embedded Checkout — ดู StripeCheckoutPanel.tsx และ wallet.service.ts ฝั่ง apps/api)
 *  ดู wf_empty_states.png */
export function WalletContent({ user, initialBalance }: WalletContentProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [selectedPkg, setSelectedPkg] = useState<CoinPackage | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [creditedCoins, setCreditedCoins] = useState<number | null>(null);
  // ครบรอบ poll แล้วยังไม่เจอเงินเข้า แต่ session ยัง "open" อยู่จริง (เช็คกับ Stripe แล้ว) — แค่ยังไม่
  // จ่าย/รออยู่ ไม่ใช่ล้มเหลว จึงยังลองเช็คซ้ำเองได้
  const [paymentPending, setPaymentPending] = useState(false);
  // เช็คกับ Stripe แล้วพบว่า session หมดอายุจริง (status: expired) — รายการนี้ไม่มีทางสำเร็จได้อีก
  // ต้องกดซื้อใหม่เท่านั้น ต่างจาก paymentPending ตรงที่นี่คือ "ทำรายการไม่สำเร็จ" จริง ๆ
  const [paymentFailed, setPaymentFailed] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const balanceRef = useRef(initialBalance);
  const isPollingRef = useRef(false);
  const pendingRef = useRef<{ sessionId: string | null; startedAt: number }>({
    sessionId: null,
    startedAt: Date.now(),
  });

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // เพิ่มภายหลัง (audit fix) — Stripe redirect กลับมาที่นี่พร้อม checkout_session_id หลังจ่ายเงินเสร็จ
  // การเติมคอยน์จริงเกิดจาก webhook ฝั่ง server (อาจมาถึงก่อน/หลัง redirect นี้เล็กน้อย ไม่ได้เรียงลำดับ
  // กันเป๊ะ ๆ) จึง poll ยอด balance สั้น ๆ (ทุก 1 วิ สูงสุด 6 ครั้ง) แทนที่จะเชื่อ initialBalance ตรง ๆ
  // ให้ผู้ใช้เห็นยอดอัปเดตไวภายในไม่กี่วินาทีโดยไม่ต้องกด refresh เอง ตามที่ขอไว้
  async function checkSessionStatusAndFinish(startBalance: number, sessionId: string | null) {
    // ครบรอบ poll ยอด balance สั้น ๆ แล้วยังไม่เจอเงินเข้า — ถ้ามี session id ให้ถาม Stripe ตรง ๆ ว่า
    // session นี้จบสถานะเป็นอะไรกันแน่ แยก "ยังไม่จ่าย/รออยู่" (status: open — ยังไม่ถึง 30 นาที) ออกจาก
    // "หมดอายุ/ไม่สำเร็จจริง" (status: expired) ยึดตามสถานะจริงจาก Stripe เท่านั้น ไม่ตัดสินเองฝั่งเว็บ
    if (!sessionId) {
      setPaymentPending(true);
      return;
    }
    try {
      const res = await fetch(`/api/v1/wallet/topup/checkout-session/${sessionId}/status`);
      if (res.ok) {
        const json = (await res.json()) as { status: string; payment_status: string };
        if (json.status === "expired") {
          setPaymentFailed(true);
          clearPendingTopup();
          return;
        }
        if (json.status === "complete") {
          // Stripe บอกว่าจ่ายเสร็จแล้วจริง แต่ webhook อาจยังมาไม่ถึง (ช้ากว่าปกติ) — เช็คยอดอีกทีสุดท้าย
          const balRes = await fetch("/api/v1/wallet/transactions");
          if (balRes.ok) {
            const balJson = (await balRes.json()) as { balance: number };
            if (balJson.balance !== startBalance) {
              setBalance(balJson.balance);
              setCreditedCoins(balJson.balance - startBalance);
              clearPendingTopup();
              return;
            }
          }
        }
      }
    } catch {
      // เช็คสถานะไม่สำเร็จ (network ฯลฯ) — fallback ไปโชว์แบบ "ยังไม่ยืนยัน รอ/ลองใหม่" ปลอดภัยไว้ก่อน
    }
    setPaymentPending(true);
  }

  function startPolling(
    startBalance: number,
    sessionId: string | null = pendingRef.current.sessionId,
    startedAt: number = pendingRef.current.startedAt
  ) {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    pendingRef.current = { sessionId, startedAt };
    setConfirmingPayment(true);
    setPaymentPending(false);
    setPaymentFailed(false);
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch("/api/v1/wallet/transactions");
        if (res.ok) {
          const json = (await res.json()) as { balance: number };
          if (json.balance !== startBalance) {
            setBalance(json.balance);
            setCreditedCoins(json.balance - startBalance);
            clearInterval(poll);
            isPollingRef.current = false;
            setConfirmingPayment(false);
            clearPendingTopup();
            return;
          }
        }
      } catch {
        // เชื่อมต่อไม่สำเร็จรอบนี้ — ลองรอบถัดไป ไม่ต้องแจ้ง error ให้กวนใจ
      }
      if (attempts >= BALANCE_POLL_MAX_ATTEMPTS) {
        clearInterval(poll);
        isPollingRef.current = false;
        setConfirmingPayment(false);
        void checkSessionStatusAndFinish(startBalance, sessionId);
        // หมายเหตุ pending flag: ไม่ลบตอนหมดรอบ (นอกจาก checkSessionStatusAndFinish จะลบเพราะเจอ
        // expired/สำเร็จ) เผื่อผู้ใช้ยังไม่ได้จ่ายจริง พอสลับกลับมาแท็บนี้อีกครั้งจะเช็คซ้ำได้อีก
      }
    }, BALANCE_POLL_INTERVAL_MS);
  }

  // Stripe redirect กลับมาที่แท็บนี้ตรง ๆ พร้อม checkout_session_id (เคสจ่ายด้วยบัตร)
  useEffect(() => {
    const sessionId = searchParams.get("checkout_session_id");
    if (!sessionId) return;
    router.replace("/wallet");
    // ปกติ localStorage จะมี startedAt จริงอยู่แล้ว (StripeCheckoutPanel เขียนไว้ตอนสร้าง session) —
    // ใช้ค่านั้นถ้ามีตรงกับ session นี้ ถ้าไม่มีค่อย fallback เป็นตอนนี้เลย
    const pending = readPendingTopup();
    const startedAt = pending?.sessionId === sessionId ? pending.startedAt : Date.now();
    startPolling(balanceRef.current, sessionId, startedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เพิ่มภายหลัง — วิธีจ่ายบางแบบ (เช่น PromptPay) เปิดเป็นแท็บ/popup แยกไปจ่ายที่ payments.stripe.com
  // เอง ไม่ redirect กลับมาที่แท็บ BuddyBook เดิมผ่าน return_url ตรง ๆ เคสนี้จับด้วย checkout_session_id
  // ไม่ได้ จึงใช้ localStorage flag (ตั้งไว้ตอนเปิด StripeCheckoutPanel พร้อม session id) เช็คแทนตอน
  // แท็บนี้กลับมา active อีกครั้ง (สลับแท็บ/ปิด popup แล้วโฟกัสกลับมา)
  useEffect(() => {
    function checkPendingTopup() {
      if (isPollingRef.current) return;
      const pending = readPendingTopup();
      if (!pending) return;
      if (Date.now() - pending.startedAt > STALE_PENDING_MAX_AGE_MS) {
        // ค้างมานานเกินไป (เกินกว่าที่ Stripe session จะยังมีอยู่จริงแน่ ๆ) — ล้างทิ้งเงียบ ๆ ไม่ต้องโชว์
        // popup อะไร ไม่ใช่การตัดสินว่ารายการล้มเหลว แค่ garbage collection
        clearPendingTopup();
        return;
      }
      startPolling(balanceRef.current, pending.sessionId, pending.startedAt);
    }

    document.addEventListener("visibilitychange", checkPendingTopup);
    window.addEventListener("focus", checkPendingTopup);
    checkPendingTopup();
    return () => {
      document.removeEventListener("visibilitychange", checkPendingTopup);
      window.removeEventListener("focus", checkPendingTopup);
    };
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
                🪙 {balance.toLocaleString()}
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

      {confirmingPayment && creditedCoins === null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setConfirmingPayment(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-card bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setConfirmingPayment(false)}
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

      {paymentPending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setPaymentPending(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-card bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPaymentPending(false)}
              aria-label="ปิด"
              className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-5 w-5" />
            </button>
            <AlertCircle className="mx-auto h-14 w-14 text-amber-500" />
            <h2 className="mt-4 text-h3 text-neutral-900">ยังไม่ได้ชำระเงิน</h2>
            <p className="mt-2 text-neutral-600">
              รายการนี้ยังรอการชำระเงินอยู่ ยังไม่ถือว่าล้มเหลว — ถ้าคุณกำลังจ่ายอยู่ในอีกแท็บ ระบบจะเช็คให้
              อีกครั้งเมื่อคุณกลับมาที่หน้านี้ หรือกดเช็คซ้ำได้เลย
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPaymentPending(false)}
                className="flex-1 rounded-button border border-neutral-300 py-2.5 font-bold text-neutral-700 hover:bg-neutral-50"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentPending(false);
                  startPolling(balanceRef.current);
                }}
                className="flex-1 rounded-button bg-primary-500 py-2.5 font-bold text-white hover:bg-primary-600"
              >
                เช็คอีกครั้ง
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentFailed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setPaymentFailed(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-card bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPaymentFailed(false)}
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
              onClick={() => setPaymentFailed(false)}
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
