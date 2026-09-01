import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";
import { verifySlipSchema } from "@/lib/api/schemas";

// POST /api/v1/wallet/topup/verify-slip — ส่วนขยายนอก API_Endpoints.md เดิม (ดู lib/slipok.ts ฝั่ง apps/api)
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, verifySlipSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "POST",
    path: "/wallet/topup/verify-slip",
    token: auth.token,
    body: parsed.data,
  });
}
