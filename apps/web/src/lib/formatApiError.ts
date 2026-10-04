import { describeFieldErrors, isThai, knownErrorMessage } from "@/lib/api/errorMessages";

/** เพิ่มภายหลัง (audit fix) — เดิม form ต่าง ๆ อ่านแค่ json.error ("Validation failed" เฉย ๆ)
 *  ทิ้ง json.details (zod .flatten() ที่ backend ส่งมาด้วยเสมอตอน validation ไม่ผ่าน — ดู
 *  apps/api/src/app.ts) ทำให้ผู้ใช้ไม่รู้ว่า field ไหนผิดจริง ๆ เมื่อ validation ที่ backend เช็ค
 *  เข้มกว่าที่ frontend เช็คเอง (เช่น ความยาว title/synopsis เกิน, จำนวนแท็กเกิน limit) */
interface ApiErrorBody {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
}

export function formatApiError(json: unknown, fallback: string): string {
  if (!json || typeof json !== "object") return fallback;
  const body = json as ApiErrorBody;

  // ระบุช่องที่ผิดเป็นภาษาไทย (เดิมแสดงชื่อ field ภาษาโปรแกรม เช่น "email: Invalid email")
  const fields = describeFieldErrors(body.details?.fieldErrors, body.details?.formErrors);
  if (fields) return fields;

  if (typeof body.error === "string" && body.error) {
    // error จาก proxy เป็นไทยแล้ว — ภาษาอังกฤษที่ไม่รู้จักใช้ข้อความ fallback ของหน้านั้น (เจาะจงกว่าข้อความกลาง)
    return isThai(body.error) ? body.error : knownErrorMessage(body.error) ?? fallback;
  }
  return fallback;
}

/**
 * ข้อความจาก error ที่ catch ได้ (เช่น throw new Error(formatApiError(...))) — แสดงเฉพาะข้อความภาษาไทย
 * ที่เราตั้งเอง ส่วน error ของเบราว์เซอร์ (เช่น "Failed to fetch" ตอนเน็ตหลุด) ใช้ fallback แทน
 */
export function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && isThai(e.message) ? e.message : fallback;
}
