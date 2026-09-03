import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";
import { createCheckoutSessionSchema } from "@/lib/api/schemas";

// POST /api/v1/wallet/topup/checkout-session — เพิ่มภายหลัง (audit fix) สร้าง Stripe Checkout
// Session (ui_mode: embedded) แทนการอัปโหลดสลิปเป็นทางหลัก ดู wallet.service.ts ฝั่ง apps/api
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, createCheckoutSessionSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "POST",
    path: "/wallet/topup/checkout-session",
    token: auth.token,
    body: parsed.data,
  });
}
