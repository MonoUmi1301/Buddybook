import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/chapters/:chapterId/purchase — ปลดล็อกตอนติดเหรียญ
export async function POST(_request: Request, props: { params: Promise<{ chapterId: string }> }) {
  const params = await props.params;
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;
  const id = requireUuidParam(params.chapterId, "chapter_id");
  if ("error" in id) return id.error;
  return forwardToApi({ method: "POST", path: `/chapters/${id.value}/purchase`, token: auth.token });
}
