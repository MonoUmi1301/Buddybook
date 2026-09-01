import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { createTagSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/admin/tags — Public (ใช้แสดงตัวเลือกแท็กตอน Onboarding/สร้างนิยาย)
export async function GET() {
  return forwardToApi({ method: "GET", path: "/admin/tags" });
}

// POST /api/v1/admin/tags — Admin เท่านั้น
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, createTagSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "POST",
    path: "/admin/tags",
    token: auth.token,
    body: parsed.data,
  });
}
