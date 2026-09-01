import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { createCommentSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/chapters/:chapterId/comments — Public
export async function GET(_request: Request, { params }: { params: { chapterId: string } }) {
  const id = requireUuidParam(params.chapterId, "chapter_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "GET", path: `/chapters/${id.value}/comments` });
}

// POST /api/v1/chapters/:chapterId/comments
export async function POST(request: Request, { params }: { params: { chapterId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.chapterId, "chapter_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, createCommentSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "POST",
    path: `/chapters/${id.value}/comments`,
    token: auth.token,
    body: parsed.data,
  });
}
