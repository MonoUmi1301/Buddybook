import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { autosaveChapterSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// PATCH /api/v1/chapters/:chapterId/autosave — เรียกทุก 30 วินาทีจาก Quill editor
export async function PATCH(request: Request, { params }: { params: { chapterId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.chapterId, "chapter_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, autosaveChapterSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/chapters/${id.value}/autosave`,
    token: auth.token,
    body: parsed.data,
  });
}
