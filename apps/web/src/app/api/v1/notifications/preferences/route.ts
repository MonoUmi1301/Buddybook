import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validate";
import { notificationPreferencesSchema } from "@/lib/api/schemas";

// GET/PUT /api/v1/notifications/preferences — ประเภทแจ้งเตือนที่ปิดไว้ (gap 3.3)
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({ method: "GET", path: "/notifications/preferences", token: auth.token });
}

export async function PUT(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const parsed = await parseJsonBody(request, notificationPreferencesSchema);
  if ("error" in parsed) return parsed.error;
  return forwardToApi({ method: "PUT", path: "/notifications/preferences", token: auth.token, body: parsed.data });
}
