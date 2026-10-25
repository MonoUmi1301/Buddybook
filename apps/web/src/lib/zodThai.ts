import { z } from "zod";

/**
 * ข้อความ validation ภาษาไทยสำหรับ zod ทั้งแอป (เดิมเป็นค่า default ภาษาอังกฤษ เช่น "Invalid email",
 * "String must contain at least 8 character(s)" ซึ่งไปโผล่ในป็อปอัปให้ผู้ใช้เห็นตรง ๆ แล้วไม่เข้าใจ)
 * schema ที่ตั้งข้อความเองไว้แล้ว (เช่น .min(4, "หัวข้ออย่างน้อย 4 ตัวอักษร")) ยังใช้ข้อความนั้นตามเดิม
 * — ไฟล์นี้มีสำเนาใน apps/api/src/lib/zodThai.ts (สองแอปไม่แชร์โค้ดกัน) แก้ให้ตรงกันทั้งคู่
 * zod 4: ตั้งผ่าน z.config({ customError }) และ issue code/ชื่อ field เปลี่ยนจาก zod 3 (invalid_format, origin ฯลฯ)
 */
const STRING_FORMAT: Record<string, string> = {
  email: "รูปแบบอีเมลไม่ถูกต้อง",
  url: "ลิงก์ไม่ถูกต้อง",
  uuid: "รหัสอ้างอิงไม่ถูกต้อง",
  datetime: "รูปแบบวันเวลาไม่ถูกต้อง",
  date: "รูปแบบวันที่ไม่ถูกต้อง",
  regex: "รูปแบบไม่ถูกต้อง",
};

export const thaiErrorMap: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.input === undefined || issue.input === null) return "จำเป็นต้องกรอก";
      if (issue.expected === "number" || issue.expected === "int" || issue.expected === "bigint") return "ต้องเป็นตัวเลข";
      if (issue.expected === "date") return "วันที่ไม่ถูกต้อง";
      return "ข้อมูลไม่ถูกต้อง";
    case "invalid_format":
      return STRING_FORMAT[issue.format] ?? "รูปแบบไม่ถูกต้อง";
    case "too_small":
      if (issue.origin === "string") {
        return Number(issue.minimum) <= 1 ? "จำเป็นต้องกรอก" : `ต้องมีอย่างน้อย ${issue.minimum} ตัวอักษร`;
      }
      if (issue.origin === "array" || issue.origin === "set") return `ต้องเลือกอย่างน้อย ${issue.minimum} รายการ`;
      if (issue.origin === "number" || issue.origin === "int" || issue.origin === "bigint") {
        return issue.inclusive ? `ต้องไม่น้อยกว่า ${issue.minimum}` : `ต้องมากกว่า ${issue.minimum}`;
      }
      return "ค่าน้อยเกินไป";
    case "too_big":
      if (issue.origin === "string") return `ยาวได้ไม่เกิน ${issue.maximum} ตัวอักษร`;
      if (issue.origin === "array" || issue.origin === "set") return `เลือกได้ไม่เกิน ${issue.maximum} รายการ`;
      if (issue.origin === "number" || issue.origin === "int" || issue.origin === "bigint") {
        return issue.inclusive ? `ต้องไม่เกิน ${issue.maximum}` : `ต้องน้อยกว่า ${issue.maximum}`;
      }
      return "ค่ามากเกินไป";
    case "invalid_value":
    case "invalid_union":
      return "ตัวเลือกไม่ถูกต้อง";
    case "not_multiple_of":
      return `ต้องเป็นจำนวนเท่าของ ${issue.divisor}`;
    case "unrecognized_keys":
      return "มีข้อมูลที่ไม่รู้จักปนมา";
    case "custom":
      return issue.message ?? "ข้อมูลไม่ถูกต้อง";
    default:
      return undefined;
  }
};

z.config({ customError: thaiErrorMap });
