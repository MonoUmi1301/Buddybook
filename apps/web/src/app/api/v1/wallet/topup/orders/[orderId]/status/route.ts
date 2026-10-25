import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/wallet/topup/orders/:orderId/status — สถานะคำสั่งเติม coin จาก DB (PENDING | PAID | FAILED)
// webhook ฝั่ง API เป็นคนเปลี่ยนสถานะ — หน้าเว็บแค่อ่าน ไม่เดาสถานะจาก Stripe เอง
export async function GET(_request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.orderId, "order_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "GET", path: `/wallet/topup/orders/${id.value}/status`, token: auth.token });
}
