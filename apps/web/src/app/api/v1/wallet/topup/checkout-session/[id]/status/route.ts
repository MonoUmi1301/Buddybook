import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";
import { requireStripeSessionIdParam } from "@/lib/api/validate";

// GET /api/v1/wallet/topup/checkout-session/:id/status — เพิ่มภายหลัง (แยก "ยังไม่จ่าย/รออยู่" ออก
// จาก "รายการหมดอายุ/ไม่สำเร็จจริง" ตอน balance-poll สั้น ๆ ใน WalletContent.tsx ครบรอบแล้วยังไม่เจอ
// เงินเข้า) ดู getStripeCheckoutSessionStatus ฝั่ง apps/api
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireStripeSessionIdParam(params.id);
  if ("error" in id) return id.error;

  return forwardToApi({
    method: "GET",
    path: `/wallet/topup/checkout-session/${id.value}/status`,
    token: auth.token,
  });
}
