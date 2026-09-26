import type { Request, Response } from "express";
import { z } from "zod";
import * as walletService from "@/modules/wallet/wallet.service";
import { getStripeClient } from "@/lib/stripe";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import { resolveStripeSession } from "@/lib/payments/resolveStatus";
import * as withdrawalsService from "@/modules/wallet/withdrawals.service";

export async function listTransactions(req: Request, res: Response) {
  const result = await walletService.listTransactions(req.user!.user_id);
  res.status(200).json(result);
}

const verifySlipBodySchema = z.object({
  package_id: z.string().min(1),
  slip_image_url: z.string().url(),
});

export async function verifyTopupSlip(req: Request, res: Response) {
  const body = verifySlipBodySchema.parse(req.body);
  const transaction = await walletService.verifyTopupSlip(req.user!.user_id, body.package_id, body.slip_image_url);
  res.status(201).json(transaction);
}

const createCheckoutSessionBodySchema = z.object({
  package_id: z.string().min(1),
});

/** POST /wallet/topup/checkout-session (requireAuth) — สร้าง Stripe Checkout Session ให้ frontend
 *  เอา client_secret ไปฝัง Embedded Checkout ต่อ */
export async function createCheckoutSession(req: Request, res: Response) {
  const { package_id } = createCheckoutSessionBodySchema.parse(req.body);
  const result = await walletService.createStripeCheckoutSession(req.user!.user_id, package_id);
  res.status(201).json(result);
}

/** GET /wallet/topup/orders/:order_id/status (requireAuth) — สถานะจาก DB (PENDING | PAID | FAILED) */
export async function getTopupOrderStatus(req: Request, res: Response) {
  const { order_id } = z.object({ order_id: z.string().uuid() }).parse(req.params);
  const result = await walletService.getTopupOrderStatus(req.user!.user_id, order_id);
  res.status(200).json(result);
}

/** POST /webhooks/stripe — Public แต่ยืนยันตัวตนด้วยลายเซ็น Stripe แทน JWT (Stripe เรียกตรงจาก
 *  server ของเขา ไม่มี user session) route นี้ต้อง mount ด้วย express.raw() ก่อนถึง express.json()
 *  ตัวหลักใน app.ts เพราะ constructEvent ต้องการ raw body buffer ไปคำนวณลายเซ็นเทียบกันเป๊ะ ๆ
 *  ถ้าโดน JSON.parse ไปก่อนจะคำนวณลายเซ็นไม่ตรงกับที่ Stripe ส่งมาเลย ต่อให้ payload หน้าตาเหมือนกันทุกตัวอักษร */
export async function stripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string" || !env.STRIPE_WEBHOOK_SECRET) {
    throw ApiError.badRequest("Missing Stripe signature or STRIPE_WEBHOOK_SECRET not configured");
  }

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(req.body as Buffer, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    throw ApiError.badRequest(`Invalid Stripe webhook signature: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // ที่เดียวในระบบที่เปลี่ยนสถานะ order และเติม coin — กฎสถานะอยู่ใน lib/payments/resolveStatus.ts
  switch (event.type) {
    case "checkout.session.completed":
      // PromptPay ฯลฯ อาจ complete ทั้งที่ยัง unpaid → PENDING ต่อ รอ async_payment_succeeded/failed
      if (resolveStripeSession(event.data.object) === "PAID") await walletService.fulfillStripeTopup(event.data.object);
      break;
    case "checkout.session.async_payment_succeeded":
      await walletService.fulfillStripeTopup(event.data.object);
      break;
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await walletService.failStripeTopup(event.data.object);
      break;
    default:
      break;
  }

  // ตอบ 200 เร็วที่สุดเสมอ (แม้ event type ที่เราไม่ได้ใช้) — Stripe จะ retry ซ้ำถ้าไม่ได้ 2xx กลับไป
  res.status(200).json({ received: true });
}


// ---------------------------------------------------------------------------
// เพิ่มภายหลัง (ถอนรายได้นักเขียน) — ดู withdrawals.service.ts
// ---------------------------------------------------------------------------

export async function listWithdrawals(req: Request, res: Response) {
  res.status(200).json(await withdrawalsService.listMyWithdrawals(req.user!.user_id));
}

const createWithdrawalSchema = z
  .object({
    amount_coins: z.number().int().positive().max(10_000_000),
    payout_method: z.enum(["promptpay", "bank"]),
    account_name: z.string().trim().min(1).max(100),
    // PromptPay = เบอร์มือถือ 10 หลัก / เลขบัตรประชาชน 13 หลัก, บัญชีธนาคาร 10-15 หลัก
    account_number: z
      .string()
      .transform((v) => v.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(/^\d{10,15}$/, "account_number must be 10-15 digits")),
    bank_name: z.string().trim().min(1).max(100).optional(),
  })
  .refine((v) => v.payout_method !== "bank" || v.bank_name, {
    message: "bank_name is required for bank transfers",
    path: ["bank_name"],
  });

export async function createWithdrawal(req: Request, res: Response) {
  const body = createWithdrawalSchema.parse(req.body);
  res.status(201).json(await withdrawalsService.requestWithdrawal(req.user!.user_id, body));
}

const adminListWithdrawalsQuery = z.object({ status: z.enum(["pending", "paid", "rejected"]).optional() });

export async function adminListWithdrawals(req: Request, res: Response) {
  const { status } = adminListWithdrawalsQuery.parse(req.query);
  res.status(200).json(await withdrawalsService.adminListWithdrawals(status));
}

const withdrawalIdParam = z.object({ withdrawal_id: z.string().uuid() });
const processWithdrawalBody = z.object({
  action: z.enum(["paid", "rejected"]),
  note: z.string().trim().max(500).optional(),
});

export async function adminProcessWithdrawal(req: Request, res: Response) {
  const { withdrawal_id } = withdrawalIdParam.parse(req.params);
  const { action, note } = processWithdrawalBody.parse(req.body);
  res
    .status(200)
    .json(await withdrawalsService.adminProcessWithdrawal(withdrawal_id, req.user!.user_id, action, note));
}
