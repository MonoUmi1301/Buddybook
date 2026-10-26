import { z } from "zod";
import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

const heartbeatSchema = z.object({ leaving: z.boolean().optional() });

// POST /api/v1/presence/heartbeat — ผู้อ่านออนไลน์ (หน้าอ่านตอนส่งทุก 1 นาที, ดู apps/api/src/lib/presence.ts)
export async function POST(request: Request) {
  const auth = await requireAccessToken();
  if ("error" in auth) return auth.error;
  const parsed = await parseJsonBody(request, heartbeatSchema);
  if ("error" in parsed) return parsed.error;
  return forwardToApi({ method: "POST", path: "/presence/heartbeat", token: auth.token, body: parsed.data });
}
