import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { createChapterSchema } from "@/lib/api/schemas";
import { getAccessToken, requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/novels/:novelId/chapters — Public (แนบ token ถ้ามี — Express ใช้ req.user เพื่อโชว์
// ตอนร่างให้เจ้าของนิยายเห็นด้วย ไม่ใช่แค่ตอนที่เผยแพร่แล้ว จุดนี้ไม่เคยส่ง token ไปเลยมาก่อน)
export async function GET(_request: Request, { params }: { params: { novelId: string } }) {
  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "GET", path: `/novels/${id.value}/chapters`, token: getAccessToken() });
}

// POST /api/v1/novels/:novelId/chapters — Writer Workspace
export async function POST(request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, createChapterSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "POST",
    path: `/novels/${id.value}/chapters`,
    token: auth.token,
    body: parsed.data,
  });
}
