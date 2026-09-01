import { ApiError } from "@/utils/ApiError";
import type { Visibility } from "@prisma/client";

/** ป้องกัน novel ที่ visibility=private/pending_review รั่วไหลให้คนนอกที่รู้/เดา novel_id
 *  (หรือ chapter_id ของนิยายเรื่องนั้น) ได้ ผ่าน endpoint สาธารณะใด ๆ ที่ผูกกับนิยาย
 *  (ตัวนิยายเอง, chapters, reviews, donations, comments) — เจ้าของยังเห็นของตัวเองได้ปกติ
 *  ตั้งใจ throw notFound แทน forbidden เพื่อไม่ยืนยันว่านิยาย/ตอนที่ซ่อนอยู่มีอยู่จริง
 *  (สอดคล้องกับ pattern เดิมของ chapters.service.ts getChapterById) */
export function assertNovelVisible(
  novel: { visibility: Visibility; author_id: string },
  viewer_id: string | undefined,
  notFoundMessage = "Novel not found"
): boolean {
  const isOwner = viewer_id !== undefined && viewer_id === novel.author_id;
  if (novel.visibility !== "published" && !isOwner) {
    throw ApiError.notFound(notFoundMessage);
  }
  return isOwner;
}
