import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";

// GET /api/v1/users/:userId — Public (หน้าโปรไฟล์สาธารณะ)
export async function GET(_request: Request, { params }: { params: { userId: string } }) {
  const id = requireUuidParam(params.userId, "user_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "GET", path: `/users/${id.value}` });
}
