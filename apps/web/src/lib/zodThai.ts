import { z, ZodIssueCode, type ZodErrorMap } from "zod";

/**
 * ข้อความ validation ภาษาไทยสำหรับ zod ทั้งแอป (เดิมเป็นค่า default ภาษาอังกฤษ เช่น "Invalid email",
 * "String must contain at least 8 character(s)" ซึ่งไปโผล่ในป็อปอัปให้ผู้ใช้เห็นตรง ๆ แล้วไม่เข้าใจ)
 * schema ที่ตั้งข้อความเองไว้แล้ว (เช่น .min(4, "หัวข้ออย่างน้อย 4 ตัวอักษร")) ยังใช้ข้อความนั้นตามเดิม
 * — ไฟล์นี้มีสำเนาใน apps/api/src/lib/zodThai.ts (สองแอปไม่แชร์โค้ดกัน) แก้ให้ตรงกันทั้งคู่
 */
const STRING_FORMAT: Record<string, string> = {
  email: "รูปแบบอีเมลไม่ถูกต้อง",
  url: "ลิงก์ไม่ถูกต้อง",
  uuid: "รหัสอ้างอิงไม่ถูกต้อง",
  datetime: "รูปแบบวันเวลาไม่ถูกต้อง",
  date: "รูปแบบวันที่ไม่ถูกต้อง",
  regex: "รูปแบบไม่ถูกต้อง",
};

export const thaiErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "จำเป็นต้องกรอก" };
      if (issue.expected === "number" || issue.expected === "integer") return { message: "ต้องเป็นตัวเลข" };
      return { message: "ข้อมูลไม่ถูกต้อง" };
    case ZodIssueCode.invalid_string: {
      const v = issue.validation;
      const key = typeof v === "string" ? v : "regex";
      return { message: STRING_FORMAT[key] ?? "รูปแบบไม่ถูกต้อง" };
    }
    case ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: Number(issue.minimum) <= 1 ? "จำเป็นต้องกรอก" : `ต้องมีอย่างน้อย ${issue.minimum} ตัวอักษร` };
      }
      if (issue.type === "array") return { message: `ต้องเลือกอย่างน้อย ${issue.minimum} รายการ` };
      if (issue.type === "number" || issue.type === "bigint") {
        return { message: issue.inclusive ? `ต้องไม่น้อยกว่า ${issue.minimum}` : `ต้องมากกว่า ${issue.minimum}` };
      }
      return { message: "ค่าน้อยเกินไป" };
    case ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `ยาวได้ไม่เกิน ${issue.maximum} ตัวอักษร` };
      if (issue.type === "array") return { message: `เลือกได้ไม่เกิน ${issue.maximum} รายการ` };
      if (issue.type === "number" || issue.type === "bigint") {
        return { message: issue.inclusive ? `ต้องไม่เกิน ${issue.maximum}` : `ต้องน้อยกว่า ${issue.maximum}` };
      }
      return { message: "ค่ามากเกินไป" };
    case ZodIssueCode.invalid_enum_value:
    case ZodIssueCode.invalid_literal:
    case ZodIssueCode.invalid_union:
    case ZodIssueCode.invalid_union_discriminator:
      return { message: "ตัวเลือกไม่ถูกต้อง" };
    case ZodIssueCode.invalid_date:
      return { message: "วันที่ไม่ถูกต้อง" };
    case ZodIssueCode.not_multiple_of:
      return { message: `ต้องเป็นจำนวนเท่าของ ${issue.multipleOf}` };
    case ZodIssueCode.unrecognized_keys:
      return { message: "มีข้อมูลที่ไม่รู้จักปนมา" };
    case ZodIssueCode.custom:
      return { message: issue.message ?? "ข้อมูลไม่ถูกต้อง" };
    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(thaiErrorMap);
