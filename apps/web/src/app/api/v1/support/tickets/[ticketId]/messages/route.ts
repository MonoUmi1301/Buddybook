import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { supportMessageSchema } from "@/lib/api/schemas";

// POST /api/v1/support/tickets/:ticketId/messages (gap 3.2)
export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const id = requireUuidParam(params.ticketId, "ticket_id");
  if ("error" in id) return id.error;
  const parsed = await parseJsonBody(request, supportMessageSchema);
  if ("error" in parsed) return parsed.error;
  return forwardToApi({ method: "POST", path: `/support/tickets/${id.value}/messages`, token: auth.token, body: parsed.data });
}
