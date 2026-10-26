import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateTimelineEventSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/timeline-events/:eventId
export async function PATCH(request: Request, props: { params: Promise<{ eventId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.eventId, "event_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateTimelineEventSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/timeline-events/${id.value}`,
    token: auth.token,
    body: parsed.data,
  });
}

// DELETE /api/v1/timeline-events/:eventId — ย้ายลงถังขยะ
export async function DELETE(_request: Request, props: { params: Promise<{ eventId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.eventId, "event_id");
  if ("error" in id) return id.error;

  return forwardToApi({
    method: "DELETE",
    path: `/timeline-events/${id.value}`,
    token: auth.token,
  });
}
