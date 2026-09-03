import type { Request, Response } from "express";
import { z } from "zod";
import * as walletService from "@/modules/wallet/wallet.service";
import { getStripeClient } from "@/lib/stripe";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";

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

  if (event.type === "checkout.session.completed") {
    await walletService.creditStripeTopup(event.data.object);
  }

  // ตอบ 200 เร็วที่สุดเสมอ (แม้ event type ที่เราไม่ได้ใช้) — Stripe จะ retry ซ้ำถ้าไม่ได้ 2xx กลับไป
  res.status(200).json({ received: true });
}
