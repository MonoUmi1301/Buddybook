import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";
import { requireUuidParam } from "@/lib/api/validate";

// GET /api/v1/support/tickets/:ticketId (gap 3.2)
export async function GET(_request: Request, props: { params: Promise<{ ticketId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;
  const id = requireUuidParam(params.ticketId, "ticket_id");
  if ("error" in id) return id.error;
  return forwardToApi({ method: "GET", path: `/support/tickets/${id.value}`, token: auth.token });
}
