import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { getAccessToken } from "@/lib/api/auth";

// GET /api/v1/novels/:novelId/donations — Public (leaderboard ผู้สนับสนุน)
export async function GET(_request: Request, props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "GET", path: `/novels/${id.value}/donations`, token: await getAccessToken() });
}
