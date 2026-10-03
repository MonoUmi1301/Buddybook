/**
 * gap 2.5 — สำรองร่างตอนนิยายไว้ในเบราว์เซอร์ (localStorage) ระหว่างรอ auto-save รอบถัดไป
 * กันงานหายเมื่อเน็ตหลุด ปิดแท็บ หรือเบราว์เซอร์ค้าง ก่อนเซิร์ฟเวอร์จะได้รับ
 *
 * ใช้ localStorage (ไม่ใช่ IndexedDB) เพราะเขียนแบบ synchronous ได้ใน pagehide/visibilitychange
 * ซึ่งเป็นจังหวะสุดท้ายก่อนแท็บถูกปิด — ทุกการอ่าน/เขียนครอบ try/catch (โหมดส่วนตัว/พื้นที่เต็มต้องไม่ทำให้ editor พัง)
 */

export interface LocalDraft {
  title: string;
  content: string;
  /** epoch ms ที่เขียนลงเครื่อง */
  saved_at: number;
  /** updated_at ของตอนบนเซิร์ฟเวอร์ที่ร่างนี้แก้ต่อจาก (null = ตอนที่ยังไม่เคยบันทึก) */
  base_updated_at: string | null;
}

const PREFIX = "bb-chapter-draft:";

export function chapterDraftKey(novelId: string, chapterId: string | undefined, chapterNumber: number): string {
  return chapterId ? `${PREFIX}${chapterId}` : `${PREFIX}new:${novelId}:${chapterNumber}`;
}

export function readDraft(key: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraft>;
    if (typeof parsed.content !== "string" || typeof parsed.title !== "string") return null;
    return {
      title: parsed.title,
      content: parsed.content,
      saved_at: typeof parsed.saved_at === "number" ? parsed.saved_at : 0,
      base_updated_at: typeof parsed.base_updated_at === "string" ? parsed.base_updated_at : null,
    };
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: LocalDraft): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
