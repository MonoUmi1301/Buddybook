import { NextResponse } from "next/server";
import { callApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { refreshSchema } from "@/lib/api/schemas";
import { jsonOk, jsonError } from "@/lib/api/http";
import { getRefreshToken, setAccessTokenCookie } from "@/lib/api/auth";

// POST /api/v1/auth/refresh
// refresh_token มาจาก httpOnly cookie ของเราเองเป็นหลัก (client ฝั่ง browser ไม่มีทาง
// อ่านค่าคุกกี้นี้ได้อยู่แล้ว) รับ body.refresh_token เป็นทางเลือกสำรองเผื่อ caller
// ฝั่ง server-to-server ต้องการระบุเอง
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, refreshSchema);
  if ("error" in parsed) return parsed.error;

  const refreshToken = parsed.data.refresh_token ?? getRefreshToken();
  if (!refreshToken) {
    return jsonError("Unauthorized", 401);
  }

  const result = await callApi({
    method: "POST",
    path: "/auth/refresh",
    body: { refresh_token: refreshToken },
  });
  if ("error" in result) return result.error;

  const json = result.json as Record<string, unknown> | null;
  if (result.status !== 200 || typeof json?.access_token !== "string") {
    return NextResponse.json(json ?? { error: "Refresh failed" }, { status: result.status });
  }

  const response = jsonOk({}, 200);
  return setAccessTokenCookie(response, json.access_token);
}
