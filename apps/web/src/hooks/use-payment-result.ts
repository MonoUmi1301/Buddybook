"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED";

export type PaymentOutcome =
  | { kind: "paid"; coins: number }
  | { kind: "failed" }
  /** รอนานเกิน ~2 นาทียังไม่ยืนยัน — แจ้งครั้งเดียวแล้วหยุดเช็ค (ไม่ใช่ความล้มเหลว) */
  | { kind: "pending-timeout" };

const POLL_INTERVAL_MS = 3 * 1000;
const PENDING_NOTICE_AFTER_MS = 2 * 60 * 1000;
const HANDLED_STORAGE_KEY = "bb_topup_handled_orders";

function readHandled(): string[] {
  try {
    const raw = sessionStorage.getItem(HANDLED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function markHandled(orderId: string) {
  try {
    const next = [...readHandled().filter((id) => id !== orderId), orderId].slice(-20);
    sessionStorage.setItem(HANDLED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // sessionStorage ใช้ไม่ได้ (private mode ฯลฯ) — ยังกันซ้ำได้ด้วย handledRef ในหน้าเดิม
  }
}

/**
 * ตัวเช็คผลการจ่ายเงิน "ตัวเดียว" ของระบบ — mount เฉพาะหน้า /wallet (return_url ของ Stripe)
 *
 * - อ่านสถานะจาก API ของเรา (GET /wallet/topup/orders/:id/status) ซึ่ง webhook เป็นคนอัปเดต — ไม่เดาจาก Stripe
 * - PENDING ไม่ใช่ความล้มเหลว: เช็คทุก 3 วิ, ครบ ~2 นาทียังไม่ยืนยัน → แจ้ง "pending-timeout" ครั้งเดียวแล้วหยุด
 * - one-shot: เจอ PAID/FAILED ครั้งแรก → หยุด interval, ถอด listener, จำ order นี้ใน sessionStorage,
 *   ลบ ?topup_order ออกจาก URL แล้วเรียก onOutcome "ครั้งเดียว" — refresh/ย้อนกลับ/re-render ไม่เด้งซ้ำ
 * - focus/visibilitychange: เช็คซ้ำได้อย่างมาก 1 ครั้ง ด้วยกฎเดียวกัน
 * - StrictMode mount ซ้ำ: cleanup ล้าง interval ก่อนเสมอ จึงมี interval ได้ทีละตัว
 */
export function usePaymentResult(orderId: string | null, onOutcome: (outcome: PaymentOutcome) => void) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(false);
  const handledRef = useRef<string | null>(null);
  const onOutcomeRef = useRef(onOutcome);
  onOutcomeRef.current = onOutcome;

  useEffect(() => {
    if (!orderId || handledRef.current === orderId) return;
    if (readHandled().includes(orderId)) {
      // จัดการไปแล้วใน session นี้ (refresh/ย้อนกลับมา) — แค่ลบ param ทิ้ง ไม่เปิด modal ซ้ำ
      handledRef.current = orderId;
      router.replace(pathname, { scroll: false });
      return;
    }

    const startedAt = Date.now();
    let stopped = false;
    let inFlight = false;
    let focusRechecked = false;
    let timer: number | undefined;

    function stop() {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      setChecking(false);
    }

    function finish(outcome: PaymentOutcome) {
      if (handledRef.current === orderId) return;
      handledRef.current = orderId!;
      stop();
      markHandled(orderId!);
      router.replace(pathname, { scroll: false });
      onOutcomeRef.current(outcome);
    }

    async function check() {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(`/api/v1/wallet/topup/orders/${orderId}/status`, { cache: "no-store" });
        if (stopped) return;
        if (res.ok) {
          const json = (await res.json()) as { status: PaymentStatus; coins: number };
          if (json.status === "PAID") return finish({ kind: "paid", coins: json.coins });
          if (json.status === "FAILED") return finish({ kind: "failed" });
        } else if (res.status === 404) {
          // order ไม่ใช่ของ user นี้/ไม่มีจริง — ไม่มีอะไรให้รอ หยุดเงียบ ๆ
          handledRef.current = orderId;
          stop();
          router.replace(pathname, { scroll: false });
          return;
        }
        // PENDING (หรือเช็คไม่สำเร็จชั่วคราว) — ไม่ใช่ความล้มเหลว
        if (Date.now() - startedAt >= PENDING_NOTICE_AFTER_MS) finish({ kind: "pending-timeout" });
      } catch {
        // network สะดุด — รอบถัดไปลองใหม่
      } finally {
        inFlight = false;
      }
    }

    function onVisible() {
      if (document.visibilityState !== "visible" || focusRechecked) return;
      focusRechecked = true;
      void check();
    }

    setChecking(true);
    void check();
    timer = window.setInterval(check, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [orderId, pathname, router]);

  return { checking };
}
