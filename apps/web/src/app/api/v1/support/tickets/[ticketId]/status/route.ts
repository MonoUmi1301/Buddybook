import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { supportStatusSchema } from "@/lib/api/schemas";

// PATCH /api/v1/support/tickets/:ticketId/status (gap 3.2)
export async function PATCH(request: Request, { params }: { params: { ticketId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const id = requireUuidParam(params.ticketId, "ticket_id");
  if ("error" in id) return id.error;
  const parsed = await parseJsonBody(request, supportStatusSchema);
  if ("error" in parsed) return parsed.error;
  return forwardToApi({ method: "PATCH", path: `/support/tickets/${id.value}/status`, token: auth.token, body: parsed.data });
}
