import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { createGiftItemSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/admin/gifts — แคตตาล็อกทั้งหมดรวมที่ปิดขาย
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  return forwardToApi({ method: "GET", path: "/admin/gifts", token: auth.token });
}

// POST /api/v1/admin/gifts
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, createGiftItemSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/admin/gifts", token: auth.token, body: parsed.data });
}
