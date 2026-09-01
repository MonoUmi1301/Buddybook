import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { updateNovelSchema } from "@/lib/api/schemas";
import { getAccessToken, requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/novels/:novelId — Public (แนบ token ถ้ามีเพื่อ personalize is_liked/is_owner —
// Express รองรับ optional auth อยู่แล้วผ่าน attachUserIfPresent แต่จุดนี้ไม่เคยส่ง token ไปเลย)
export async function GET(_request: Request, { params }: { params: { novelId: string } }) {
  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "GET", path: `/novels/${id.value}`, token: getAccessToken() });
}

// PATCH /api/v1/novels/:novelId — เจ้าของนิยายเท่านั้น (Express ตรวจสิทธิ์อีกชั้น)
export async function PATCH(request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, updateNovelSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: `/novels/${id.value}`,
    token: auth.token,
    body: parsed.data,
  });
}

// DELETE /api/v1/novels/:novelId
export async function DELETE(_request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "DELETE", path: `/novels/${id.value}`, token: auth.token });
}
