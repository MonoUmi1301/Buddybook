import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { addToLibrarySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/library — ชั้นหนังสือของผู้อ่าน
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  return forwardToApi({ method: "GET", path: "/library", token: auth.token });
}

// POST /api/v1/library — บันทึกนิยายเข้าชั้นหนังสือ
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, addToLibrarySchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/library", token: auth.token, body: parsed.data });
}
