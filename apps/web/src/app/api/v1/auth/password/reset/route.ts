import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { z } from "zod";
import { passwordSchema } from "@/lib/api/schemas";

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: passwordSchema,
});

// POST /api/v1/auth/password/reset — Public
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, resetPasswordSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({ method: "POST", path: "/auth/password/reset", body: parsed.data });
}
