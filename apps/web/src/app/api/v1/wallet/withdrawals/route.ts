import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { createWithdrawalSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// GET /api/v1/wallet/withdrawals — ประวัติคำขอถอน + ยอดที่ถอนได้
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({ method: "GET", path: "/wallet/withdrawals", token: auth.token });
}

// POST /api/v1/wallet/withdrawals — ขอถอนรายได้
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const parsed = await parseJsonBody(request, createWithdrawalSchema);
  if ("error" in parsed) return parsed.error;
  return forwardToApi({ method: "POST", path: "/wallet/withdrawals", token: auth.token, body: parsed.data });
}
