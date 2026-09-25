import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, parseSearchParams } from "@/lib/api/validate";
import { addToLibrarySchema, libraryQuerySchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/library?status= — ชั้นหนังสือของผู้อ่าน (กรองตามสถานะได้)
export async function GET(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const query = parseSearchParams(request, libraryQuerySchema);
  if ("error" in query) return query.error;

  const searchParams = new URLSearchParams();
  if (query.data.status) searchParams.set("status", query.data.status);

  return forwardToApi({ method: "GET", path: "/library", token: auth.token, searchParams });
}

// POST /api/v1/library — บันทึกนิยายเข้าชั้นหนังสือ
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, addToLibrarySchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/library", token: auth.token, body: parsed.data });
}
