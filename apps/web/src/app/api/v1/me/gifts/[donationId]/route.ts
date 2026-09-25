import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateReceivedGiftSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/me/gifts/:donationId — นักเขียนทำเครื่องหมายอ่านแล้ว / ซ่อน / รายงาน
export async function PATCH(request: Request, { params }: { params: { donationId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.donationId, "donation_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateReceivedGiftSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "PATCH", path: `/me/gifts/${id.value}`, token: auth.token, body: parsed.data });
}
