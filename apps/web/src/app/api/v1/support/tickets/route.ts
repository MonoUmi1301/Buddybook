import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validate";
import { createSupportTicketSchema } from "@/lib/api/schemas";

// GET/POST /api/v1/support/tickets — เรื่องแจ้งปัญหาของฉัน / เปิดเรื่องใหม่ (gap 3.2)
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({ method: "GET", path: "/support/tickets", token: auth.token });
}

export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const parsed = await parseJsonBody(request, createSupportTicketSchema);
  if ("error" in parsed) return parsed.error;
  return forwardToApi({ method: "POST", path: "/support/tickets", token: auth.token, body: parsed.data });
}
