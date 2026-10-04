import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";
import { requireUuidParam } from "@/lib/api/validate";

// GET /api/v1/support/tickets/:ticketId (gap 3.2)
export async function GET(_request: Request, { params }: { params: { ticketId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const id = requireUuidParam(params.ticketId, "ticket_id");
  if ("error" in id) return id.error;
  return forwardToApi({ method: "GET", path: `/support/tickets/${id.value}`, token: auth.token });
}
