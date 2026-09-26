import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { processWithdrawalSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/admin/withdrawals/:withdrawalId — { action: "paid" | "rejected", note? }
export async function PATCH(request: Request, { params }: { params: { withdrawalId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const id = requireUuidParam(params.withdrawalId, "withdrawal_id");
  if ("error" in id) return id.error;
  const parsed = await parseJsonBody(request, processWithdrawalSchema);
  if ("error" in parsed) return parsed.error;
  return forwardToApi({ method: "PATCH", path: `/admin/withdrawals/${id.value}`, token: auth.token, body: parsed.data });
}
