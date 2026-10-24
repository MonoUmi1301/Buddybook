import crypto from "node:crypto";
import { parseBirthDate, type BirthDate } from "@/lib/ageVerification";

/**
 * Validating Age Logic — แปลงผลตรวจของผู้ให้บริการ (ผ่าน toKycReview ของแต่ละเจ้า) เป็นการตัดสินของเรา
 * (pure function ทดสอบได้โดยไม่เรียก API) ผู้ให้บริการตอบ Approved แล้วก็ยังตรวจซ้ำฝั่งเรา เพราะวันเกิดคือสิ่งที่ปลดล็อกเนื้อหา:
 *  1. ต้องได้ผลสุดท้าย — Declined ส่งใหม่ได้, Expired/Abandoned = หมดเวลา
 *  2. Liveness และ Face match ต้องผ่านจริง (กัน workflow ตั้งค่าขาดขั้นตอน)
 *  3. ต้องเป็นบัตรประชาชนหรือพาสปอร์ต ที่มีวันเกิดอ่านได้จากเอกสาร
 *  4. วันเกิดทุกเอกสารต้องตรงกัน — ไม่ตรง = ตัดสินอัตโนมัติไม่ได้
 *  5. วันเกิดต้องเป็นวันจริง ไม่อยู่ในอนาคต อายุไม่เกิน 120 (parseBirthDate)
 *  6. เอกสารต้องยังไม่หมดอายุ และบัตรประชาชนไทยต้องมีเลข 13 หลักที่ผ่าน checksum
 */

export const ACCEPTED_DOCUMENT_TYPES = ["ID_CARD", "PASSPORT"] as const;
type AcceptedDocType = (typeof ACCEPTED_DOCUMENT_TYPES)[number];

/** รูปแบบกลางของผลตรวจ ไม่ผูกกับผู้ให้บริการเจ้าใด */
export type KycReview =
  | { state: "pending" }
  | { state: "expired" }
  | { state: "declined"; retryAllowed: boolean }
  | {
      state: "approved";
      livenessPassed: boolean;
      faceMatchPassed: boolean;
      documents: Array<{
        type: AcceptedDocType | null;
        country: string | null;
        /** เลขที่อ่านได้จากเอกสาร (เช่นเลขประจำตัวประชาชน + เลขเอกสาร) — ใช้ตรวจ/ทำ hash แล้วทิ้ง */
        numbers: string[];
        birthDate: string | null;
        validUntil: string | null;
      }>;
    };

export type KycRejectReason =
  | "PROVIDER_REJECTED"
  | "SESSION_EXPIRED"
  | "INCOMPLETE_CHECKS"
  | "UNSUPPORTED_DOCUMENT"
  | "NO_BIRTH_DATE"
  | "INVALID_BIRTH_DATE"
  | "BIRTH_DATE_MISMATCH"
  | "DOCUMENT_EXPIRED"
  | "INVALID_ID_NUMBER"
  | "DUPLICATE_IDENTITY";

export type KycEvaluation =
  | { outcome: "pending" }
  | { outcome: "rejected"; reason: KycRejectReason; retryAllowed: boolean }
  | {
      outcome: "approved";
      birth: BirthDate;
      documentType: AcceptedDocType;
      documentCountry: string | null;
      /** ใช้ทำ hash กันเอกสารซ้ำแล้วทิ้ง — ห้ามบันทึกค่านี้ลงฐานข้อมูลหรือ log */
      documentNumber: string | null;
    };

/** checksum บัตรประชาชนไทย: หลักที่ 13 = (11 − Σ dᵢ×(13−i) mod 11) mod 10 สำหรับ i = 0..11 */
export function isValidThaiNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

export function normalizeDocumentNumber(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

/** HMAC (มี secret) ไม่ใช่ SHA-256 เปล่า ๆ — เลขบัตร 13 หลักมีแค่ ~10¹² ค่า ไล่ hash ครบได้ถ้าไม่มี key */
export function hashDocumentNumber(country: string | null, docType: string, number: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${country ?? "UNK"}:${docType}:${number}`).digest("hex");
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function evaluateKycReview(review: KycReview, now = new Date()): KycEvaluation {
  if (review.state === "pending") return { outcome: "pending" };
  if (review.state === "expired") return { outcome: "rejected", reason: "SESSION_EXPIRED", retryAllowed: true };
  if (review.state === "declined") {
    return { outcome: "rejected", reason: "PROVIDER_REJECTED", retryAllowed: review.retryAllowed };
  }
  if (!review.livenessPassed || !review.faceMatchPassed) {
    return { outcome: "rejected", reason: "INCOMPLETE_CHECKS", retryAllowed: true };
  }

  const docs = review.documents.filter(
    (d): d is (typeof review.documents)[number] & { type: AcceptedDocType } => d.type !== null
  );
  if (docs.length === 0) return { outcome: "rejected", reason: "UNSUPPORTED_DOCUMENT", retryAllowed: true };

  const dobs = new Set(docs.map((d) => d.birthDate).filter((v): v is string => Boolean(v)));
  if (dobs.size === 0) return { outcome: "rejected", reason: "NO_BIRTH_DATE", retryAllowed: true };
  if (dobs.size > 1) return { outcome: "rejected", reason: "BIRTH_DATE_MISMATCH", retryAllowed: false };

  const birth = parseBirthDate([...dobs][0], now);
  if (!birth) return { outcome: "rejected", reason: "INVALID_BIRTH_DATE", retryAllowed: false };

  const doc = docs.find((d) => d.birthDate) ?? docs[0];
  if (doc.validUntil && doc.validUntil < isoDate(now)) {
    return { outcome: "rejected", reason: "DOCUMENT_EXPIRED", retryAllowed: true };
  }

  const numbers = doc.numbers.map(normalizeDocumentNumber).filter(Boolean);
  let documentNumber: string | null = numbers[0] ?? null;
  if (doc.type === "ID_CARD" && doc.country === "THA") {
    // บัตรไทยมีทั้งเลขประจำตัวประชาชน 13 หลักและเลขหลังบัตร — ใช้ตัวที่ผ่าน checksum
    documentNumber = numbers.find(isValidThaiNationalId) ?? null;
    if (!documentNumber) return { outcome: "rejected", reason: "INVALID_ID_NUMBER", retryAllowed: true };
  }

  return { outcome: "approved", birth, documentType: doc.type, documentCountry: doc.country, documentNumber };
}
