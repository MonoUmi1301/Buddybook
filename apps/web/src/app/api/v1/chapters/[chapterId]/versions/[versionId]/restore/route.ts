import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/chapters/:chapterId/versions/:versionId/restore
export async function POST(
  _request: Request,
  { params }: { params: { chapterId: string; versionId: string } }
) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const chapterId = requireUuidParam(params.chapterId, "chapter_id");
  if ("error" in chapterId) return chapterId.error;

  const versionId = requireUuidParam(params.versionId, "version_id");
  if ("error" in versionId) return versionId.error;

  return forwardToApi({
    method: "POST",
    path: `/chapters/${chapterId.value}/versions/${versionId.value}/restore`,
    token: auth.token,
    body: {},
  });
}
