import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { createReviewSchema } from "@/lib/api/schemas";
import { getAccessToken, requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/novels/:novelId/reviews — Public (แนบ token ถ้ามี ไม่งั้นเจ้าของรีวิวที่เลือกไม่
// ระบุตัวตนจะไม่เห็นแม้แต่ชื่อ/รูปของตัวเองตอนดูรีวิวของตัวเอง — เดิมไม่เคยส่ง token เลย เหมือน
// gap เดียวกับที่เจอใน GET /novels/:novelId มาก่อน)
export async function GET(_request: Request, props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "GET", path: `/novels/${id.value}/reviews`, token: await getAccessToken() });
}

// POST /api/v1/novels/:novelId/reviews
export async function POST(request: Request, props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, createReviewSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "POST",
    path: `/novels/${id.value}/reviews`,
    token: auth.token,
    body: parsed.data,
  });
}
