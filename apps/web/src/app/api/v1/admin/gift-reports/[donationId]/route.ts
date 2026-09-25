import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { resolveGiftReportSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/admin/gift-reports/:donationId — { action: "dismiss" | "hide" }
export async function PATCH(request: Request, { params }: { params: { donationId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.donationId, "donation_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, resolveGiftReportSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/admin/gift-reports/${id.value}`,
    token: auth.token,
    body: parsed.data,
  });
}
