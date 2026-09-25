import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { thankGiftSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/me/gifts/:donationId/thank — นักเขียนตอบขอบคุณ (ครั้งเดียว) แจ้งเตือนกลับไปหาผู้ส่ง
export async function POST(request: Request, { params }: { params: { donationId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.donationId, "donation_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, thankGiftSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "POST",
    path: `/me/gifts/${id.value}/thank`,
    token: auth.token,
    body: parsed.data,
  });
}
