import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { z } from "zod";

const forgotPasswordSchema = z.object({ email: z.string().email() });

// POST /api/v1/auth/password/forgot — Public
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, forgotPasswordSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/auth/password/forgot", body: parsed.data });
}
