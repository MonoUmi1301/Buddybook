import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { createTimelineEventSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/novels/:novelId/timeline-events
export async function POST(request: Request, props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, createTimelineEventSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "POST",
    path: `/novels/${id.value}/timeline-events`,
    token: auth.token,
    body: parsed.data,
  });
}
