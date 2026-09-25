import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { createCollectionSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/collections — ชั้นย่อยทั้งหมดของผู้ใช้พร้อมนิยาย
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  return forwardToApi({ method: "GET", path: "/collections", token: auth.token });
}

// POST /api/v1/collections — สร้างชั้นย่อยใหม่
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, createCollectionSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/collections", token: auth.token, body: parsed.data });
}
