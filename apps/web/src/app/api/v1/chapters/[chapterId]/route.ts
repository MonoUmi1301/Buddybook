import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateChapterSchema } from "@/lib/api/schemas";
import { getAccessToken, requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/chapters/:chapterId — Public (เฉพาะตอนที่ published), แนบ token ถ้ามีเพื่อให้
// เจ้าของตอนดูตอนร่าง (draft) ของตัวเองได้ด้วย — จุดนี้ไม่เคยส่ง token ไปเลยมาก่อน
export async function GET(_request: Request, { params }: { params: { chapterId: string } }) {
  const id = requireUuidParam(params.chapterId, "chapter_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "GET", path: `/chapters/${id.value}`, token: getAccessToken() });
}

// PATCH /api/v1/chapters/:chapterId
export async function PATCH(request: Request, { params }: { params: { chapterId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.chapterId, "chapter_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateChapterSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/chapters/${id.value}`,
    token: auth.token,
    body: parsed.data,
  });
}

// DELETE /api/v1/chapters/:chapterId — ย้ายลงถังขยะ (soft delete 30 วัน)
export async function DELETE(_request: Request, { params }: { params: { chapterId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.chapterId, "chapter_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "DELETE", path: `/chapters/${id.value}`, token: auth.token });
}
