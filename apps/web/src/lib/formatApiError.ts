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

  const fieldErrors = body.details?.fieldErrors;
  if (fieldErrors) {
    const parts = Object.entries(fieldErrors)
      .filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length))
      .map(([field, messages]) => `${field}: ${messages[0]}`);
    if (parts.length) return parts.join(" · ");
  }

  return body.error ?? fallback;
}
