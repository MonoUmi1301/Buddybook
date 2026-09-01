import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/chapters/:chapterId/versions — ประวัติ auto-save
export async function GET(_request: Request, { params }: { params: { chapterId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.chapterId, "chapter_id");
  if ("error" in id) return id.error;

  return forwardToApi({
    method: "GET",
    path: `/chapters/${id.value}/versions`,
    token: auth.token,
  });
}
