import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams, requireUuidParam } from "@/lib/api/validate";
import { publicGiftsQuerySchema } from "@/lib/api/schemas";
import { getAccessToken } from "@/lib/api/auth";

// GET /api/v1/authors/:userId/gifts/public?novel_id= — Public ("กำลังใจจากนักอ่าน")
// แนบ token ถ้ามี เพื่อให้เจ้าของเห็นของนิยายที่ยังไม่เผยแพร่ของตัวเองได้
export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const id = requireUuidParam(params.userId, "user_id");
  if ("error" in id) return id.error;

  const query = parseSearchParams(request, publicGiftsQuerySchema);
  if ("error" in query) return query.error;

  const searchParams = new URLSearchParams();
  if (query.data.novel_id) searchParams.set("novel_id", query.data.novel_id);

  return forwardToApi({
    method: "GET",
    path: `/authors/${id.value}/gifts/public`,
    token: getAccessToken(),
    searchParams,
  });
}
