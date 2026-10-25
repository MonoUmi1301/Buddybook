import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { kycSessionSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/kyc/session — ยอมรับความยินยอม (PDPA) แล้วรับ access token ของ WebSDK ผู้ให้บริการ e-KYC
export async function POST(request: Request) {
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, kycSessionSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/kyc/session", token: auth.token, body: parsed.data });
}
