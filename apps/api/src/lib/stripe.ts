import Stripe from "stripe";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";

/** ฟีเจอร์เติมเงินผ่าน Stripe ทั้งหมด gate ตัวเองด้วยอันนี้ (เช่นเดียวกับ Cloudinary/SlipOK) */
export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!isStripeConfigured()) {
    throw ApiError.badRequest(
      "Stripe is not configured — set STRIPE_SECRET_KEY in apps/api/.env (ดู dashboard.stripe.com/test/apikeys)"
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}
