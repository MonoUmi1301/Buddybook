import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { sendGiftSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/gifts/send — ส่งของขวัญ/Custom coins พร้อมการ์ด (idempotency_key บังคับ กันหักเงินซ้ำ)
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, sendGiftSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/gifts/send", token: auth.token, body: parsed.data });
}
