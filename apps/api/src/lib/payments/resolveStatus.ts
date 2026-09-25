import type Stripe from "stripe";
import type { TopupOrderStatus } from "@prisma/client";

/** สถานะผลการจ่ายเงินที่ทั้งระบบใช้ร่วมกัน — frontend เห็นแค่ 3 ค่านี้ */
export type PaymentResult = "PENDING" | "PAID" | "FAILED";

/**
 * กฎจาก Stripe Checkout Session (ใช้ใน webhook เท่านั้น — client ไม่เดาสถานะจาก Stripe เอง)
 *   open (unpaid)                 → PENDING  (ไม่ใช่ failed เด็ดขาด — ผู้ใช้อาจยังกรอกบัตรอยู่)
 *   complete + paid               → PAID
 *   complete + unpaid (PromptPay) → PENDING  รอ async_payment_succeeded / async_payment_failed
 *   expired                       → FAILED
 */
export function resolveStripeSession(
  session: Pick<Stripe.Checkout.Session, "status" | "payment_status">
): PaymentResult {
  if (session.status === "expired") return "FAILED";
  if (session.status === "complete" && session.payment_status !== "unpaid") return "PAID";
  return "PENDING";
}

/**
 * กฎจากคำสั่งเติม coin ใน DB (แหล่งความจริงเดียว — webhook เป็นคนเปลี่ยน status)
 * pending ที่เลย expires_at แล้ว = FAILED แม้ webhook checkout.session.expired ยังมาไม่ถึง
 */
export function resolveOrderStatus(
  order: { status: TopupOrderStatus; expires_at: Date },
  now: Date = new Date()
): PaymentResult {
  if (order.status === "paid") return "PAID";
  if (order.status === "failed") return "FAILED";
  return now.getTime() > order.expires_at.getTime() ? "FAILED" : "PENDING";
}
