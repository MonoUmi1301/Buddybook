import { describe, expect, it } from "vitest";
import { z } from "zod";
import "@/lib/zodThai";
// ตัวแปลข้อความ error ของฝั่งเว็บเป็นโค้ด pure (ไม่พึ่ง Next) — ทดสอบที่นี่เพราะ apps/web ไม่มี test runner
import { describeFieldErrors, localizeErrorBody, translateErrorMessage } from "../../web/src/lib/api/errorMessages";

/** ข้อความ error ที่ผู้ใช้เห็นต้องเป็นภาษาไทยที่บอกว่าเกิดอะไรขึ้น ไม่ใช่ "Validation failed" / "Invalid novel_id" */
describe("Thai zod messages", () => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    title: z.string().max(5),
    rating: z.number().int().min(1).max(5),
    status: z.enum(["draft", "published"]),
    name: z.string().min(1),
  });

  it("explains each problem in Thai", () => {
    const r = schema.safeParse({ email: "x", password: "123", title: "ยาวเกินไปแล้ว", rating: 9, status: "nope" });
    expect(r.success).toBe(false);
    const f = (r as z.SafeParseError<unknown>).error.flatten().fieldErrors as Record<string, string[]>;
    expect(f.email[0]).toBe("รูปแบบอีเมลไม่ถูกต้อง");
    expect(f.password[0]).toBe("ต้องมีอย่างน้อย 8 ตัวอักษร");
    expect(f.title[0]).toBe("ยาวได้ไม่เกิน 5 ตัวอักษร");
    expect(f.rating[0]).toBe("ต้องไม่เกิน 5");
    expect(f.status[0]).toBe("ตัวเลือกไม่ถูกต้อง");
    expect(f.name[0]).toBe("จำเป็นต้องกรอก");
  });

  it("keeps messages a schema sets itself", () => {
    const r = z.string().min(4, "หัวข้ออย่างน้อย 4 ตัวอักษร").safeParse("ab");
    expect((r as z.SafeParseError<string>).error.issues[0].message).toBe("หัวข้ออย่างน้อย 4 ตัวอักษร");
  });
});

describe("web error translation", () => {
  it("turns a validation failure into a Thai summary with field labels", () => {
    const out = localizeErrorBody(400, {
      error: "Validation failed",
      details: { fieldErrors: { email: ["รูปแบบอีเมลไม่ถูกต้อง"], some_internal_flag: ["ข้อมูลไม่ถูกต้อง"] }, formErrors: [] },
    }) as { error: string; error_en: string };
    expect(out.error).toBe("กรุณาตรวจสอบข้อมูล — อีเมล: รูปแบบอีเมลไม่ถูกต้อง · ข้อมูลไม่ถูกต้อง");
    expect(out.error).not.toContain("some_internal_flag");
    expect(out.error_en).toBe("Validation failed");
  });

  it("translates known API messages and keeps codes", () => {
    const out = localizeErrorBody(403, { error: "Forbidden", details: { code: "X" } }) as { error: string; details: { code: string } };
    expect(out.error).toBe("คุณไม่มีสิทธิ์ทำรายการนี้");
    expect(out.details.code).toBe("X");
    expect(translateErrorMessage("Invalid credentials", 401)).toBe("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    expect(translateErrorMessage("Invalid novel_id", 400)).toContain("ลิงก์ไม่ถูกต้อง");
  });

  it("falls back by status for unknown English and leaves Thai alone", () => {
    expect(translateErrorMessage("Some new backend error", 409)).toContain("รีเฟรชหน้า");
    expect(translateErrorMessage("Weird", 500)).toBe("ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง");
    expect(translateErrorMessage("เหรียญไม่พอ", 422)).toBe("เหรียญไม่พอ");
    const ok = { novel_id: "x" };
    expect(localizeErrorBody(200, ok)).toBe(ok);
  });

  it("never shows raw field names", () => {
    expect(describeFieldErrors({ content_snapshot: ["จำเป็นต้องกรอก"] })).toBe("เนื้อหา: จำเป็นต้องกรอก");
    expect(describeFieldErrors({})).toBeNull();
  });
});

describe("field labels", () => {
  it("does not repeat the field name when the schema message already says it", () => {
    expect(
      describeFieldErrors({ subject: ["หัวข้ออย่างน้อย 4 ตัวอักษร"], body: ["รายละเอียดอย่างน้อย 10 ตัวอักษร"] })
    ).toBe("หัวข้ออย่างน้อย 4 ตัวอักษร · รายละเอียดอย่างน้อย 10 ตัวอักษร");
  });
});
