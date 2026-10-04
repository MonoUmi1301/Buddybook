import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validate";
import { notificationReadAllSchema } from "@/lib/api/schemas";

// PATCH /api/v1/notifications/read-all (gap 3.3)
export async function PATCH(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const parsed = await parseJsonBody(request, notificationReadAllSchema);
  if ("error" in parsed) return parsed.error;
  return forwardToApi({ method: "PATCH", path: "/notifications/read-all", token: auth.token, body: parsed.data });
}
