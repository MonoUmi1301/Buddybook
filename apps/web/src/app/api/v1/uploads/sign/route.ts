import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { uploadSignSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/uploads/sign — เตรียม signature สำหรับ Cloudinary signed direct upload
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, uploadSignSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/uploads/sign", token: auth.token, body: parsed.data });
}
