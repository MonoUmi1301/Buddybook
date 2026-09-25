"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { X } from "lucide-react";
import type { CoinPackage } from "@/components/wallet/CoinPackageRow";

// เพิ่มภายหลัง (audit fix — เปลี่ยนจาก SlipOK/อัปโหลดสลิปมาใช้ Stripe) — โหลด Stripe.js แค่ครั้งเดียว
// ระดับโมดูล ไม่ใช่ทุกครั้งที่ component render (ตามที่ Stripe แนะนำ กัน re-init ไม่จำเป็น)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

interface StripeCheckoutPanelProps {
  pkg: CoinPackage;
  onClose: () => void;
}

/** ฝังฟอร์มจ่ายเงินของ Stripe ไว้ในหน้าเว็บเราเอง (Embedded Checkout) แทนการอัปโหลดรูปสลิปแบบเดิม —
 *  ไม่สร้าง Product/Price ใน Stripe Dashboard ล่วงหน้า (ดูเหตุผลใน wallet.service.ts) จ่ายเงินเสร็จ
 *  Stripe จะ redirect ทั้งหน้าไปที่ return_url (/wallet?topup_order=...) ที่ตั้งไว้ฝั่ง backend
 *  — การเติมคอยน์เกิดจาก webhook ฝั่ง server เท่านั้น (ดู stripeWebhook ใน wallet.controller.ts)
 *  หน้า /wallet แค่อ่านสถานะ order จาก API (usePaymentResult) แล้วแสดงผลครั้งเดียว */
export function StripeCheckoutPanel({ pkg, onClose }: StripeCheckoutPanelProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ref เก็บ request ไว้ — StrictMode (dev) รัน effect สองรอบ ถ้ายิงใหม่ทุกรอบจะได้ 2 Checkout Session
  // ต่อการเปิดแผงหนึ่งครั้ง (ของเดิมเป็นแบบนั้น) ให้ทั้งสองรอบใช้ request เดียวกัน
  const requestRef = useRef<{ pkgId: string; promise: Promise<{ client_secret: string }> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!requestRef.current || requestRef.current.pkgId !== pkg.id) {
      requestRef.current = {
        pkgId: pkg.id,
        promise: fetch("/api/v1/wallet/topup/checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package_id: pkg.id }),
        }).then(async (res) => {
          const json = await res.json().catch(() => null);
          if (!res.ok) throw new Error(json?.error ?? "สร้างรายการชำระเงินไม่สำเร็จ");
          return json as { client_secret: string };
        }),
      };
    }
    // ไม่เก็บ session/order ไว้ใน storage แล้ว — return_url พา ?topup_order= กลับมาที่ /wallet เอง
    // (ตัวเช็คสถานะมีตัวเดียวคือ usePaymentResult ใน WalletContent)
    requestRef.current.promise
      .then((json) => {
        if (!cancelled) setClientSecret(json.client_secret);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
      });
    return () => {
      cancelled = true;
    };
  }, [pkg.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">
            เติม {pkg.coins} coin ({pkg.priceLabel})
          </h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {!error && !clientSecret && (
          <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
            กำลังเตรียมหน้าชำระเงิน...
          </div>
        )}

        {clientSecret && (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </div>
    </div>
  );
}
