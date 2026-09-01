import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { createNovelSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/novels — สร้างนิยายเรื่องใหม่ (Writer Workspace)
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, createNovelSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/novels", token: auth.token, body: parsed.data });
}
