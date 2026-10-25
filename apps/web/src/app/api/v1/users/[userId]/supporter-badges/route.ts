import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";

// GET /api/v1/users/:userId/supporter-badges — Public (ป้ายผู้สนับสนุนบนโปรไฟล์)
export async function GET(_request: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const id = requireUuidParam(params.userId, "user_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "GET", path: `/users/${id.value}/supporter-badges` });
}
