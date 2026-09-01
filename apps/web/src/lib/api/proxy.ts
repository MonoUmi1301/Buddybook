import { NextResponse } from "next/server";
import { API_BASE, API_TIMEOUT_MS } from "@/lib/api/config";
import { jsonError } from "@/lib/api/http";

export interface ForwardOptions {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** ต่อท้าย API_BASE เช่น "/novels/123/chapters" */
  path: string;
  /** แนบเป็น Authorization: Bearer <token> — ไม่ใส่ถ้าเป็น Public endpoint */
  token?: string;
  /** body ที่ผ่าน zod validate แล้วเท่านั้น (ดู lib/api/schemas.ts) */
  body?: unknown;
  searchParams?: URLSearchParams;
}

export type ApiResult = { status: number; json: unknown } | { error: NextResponse };

/**
 * เรียก Express API Gateway (apps/api) ตัวเดียวที่มีสิทธิ์เขียน PostgreSQL/Neo4j จริง
 * ดูเหตุผลของดีไซน์นี้ใน BuddyBook_System_Architecture.md ส่วนที่ 1 (Gateway เดียว
 * กัน data drift) — คืน status/json ดิบให้ caller ตัดสินใจต่อ (เช่น route ที่ต้อง
 * อ่าน token จาก response แล้วแปลงเป็น httpOnly cookie อย่าง /auth/login)
 */
export async function callApi({
  method,
  path,
  token,
  body,
  searchParams,
}: ForwardOptions): Promise<ApiResult> {
  const url = `${API_BASE}${path}${searchParams && searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { error: jsonError("Upstream API timeout", 504) };
    }
    return { error: jsonError("Upstream API unavailable", 502) };
  }

  if (upstream.status === 204) {
    return { status: 204, json: null };
  }

  const raw = await upstream.text();
  if (!raw) {
    return { status: upstream.status, json: null };
  }

  try {
    return { status: upstream.status, json: JSON.parse(raw) as unknown };
  } catch {
    return { error: jsonError("Upstream API returned an invalid response", 502) };
  }
}

/**
 * Passthrough ธรรมดา — ส่ง response ของ Express กลับตรง ๆ ทั้ง status/body เพื่อให้
 * shape ตรงกับที่ระบุใน API_Endpoints.md เสมอ ไม่ห่อ envelope ใหม่ ใช้กับ endpoint
 * ส่วนใหญ่ที่ไม่ต้องแตะ response (ยกเว้นกลุ่ม auth ที่ต้องดัก token ไปทำ httpOnly cookie)
 */
export async function forwardToApi(opts: ForwardOptions): Promise<NextResponse> {
  const result = await callApi(opts);
  if ("error" in result) return result.error;
  if (result.status === 204 || result.json === null) {
    return new NextResponse(null, { status: result.status });
  }
  return NextResponse.json(result.json, { status: result.status });
}
