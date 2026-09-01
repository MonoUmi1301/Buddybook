import type { NextResponse } from "next/server";
import { z, type ZodSchema } from "zod";
import { jsonError, jsonValidationError } from "@/lib/api/http";

const uuidSchema = z.string().uuid();

/** ตรวจ dynamic route param ที่ต้องเป็น UUID (novel_id, chapter_id, ฯลฯ) ก่อนยิงต่อ */
export function requireUuidParam(
  value: string,
  field: string
): { value: string } | { error: NextResponse } {
  if (!uuidSchema.safeParse(value).success) {
    return { error: jsonError(`Invalid ${field}`, 400) };
  }
  return { value };
}

/** ตรวจ dynamic route param ที่ต้องเป็นเลข int (tag_id — SERIAL PK ใน data dictionary) */
export function requireIntParam(
  value: string,
  field: string
): { value: string } | { error: NextResponse } {
  if (!/^\d+$/.test(value)) {
    return { error: jsonError(`Invalid ${field}`, 400) };
  }
  return { value };
}

/** Parse + validate JSON body ก่อนส่งต่อไป Express เสมอ (ข้อ 2 ของงาน: Validation ฝั่ง Server) */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: jsonError("Invalid JSON body", 400) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: jsonValidationError(parsed.error.flatten()) };
  }
  return { data: parsed.data };
}

/** Validate query string (เช่น /novels/search?q=&tag_id=&status=&page=) */
export function parseSearchParams<T>(
  request: Request,
  schema: ZodSchema<T>
): { data: T } | { error: NextResponse } {
  const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: jsonValidationError(parsed.error.flatten()) };
  }
  return { data: parsed.data };
}
