import { NextResponse } from "next/server";

/**
 * รูปแบบ JSON response มาตรฐานทั้งระบบ — ใช้ shape เดียวกับ Express Gateway
 * (`{"error": "..."}` ตอน fail, body ตรง ๆ ตอน success) ตาม API_Endpoints.md
 * เพื่อให้ frontend/consumer ไม่ต้องแยก branch ว่า error มาจาก Next.js layer
 * หรือจาก Express Gateway
 */
export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json(details ? { error: message, details } : { error: message }, {
    status,
  });
}

export function jsonNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function jsonValidationError(details: unknown): NextResponse {
  return jsonError("Validation failed", 400, details);
}
