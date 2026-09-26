/** ชนิดข้อมูลหน้า My Library / "อ่านต่อ" — ตรงกับ response ของ GET /library, /library/continue-reading,
 *  /collections (ดู apps/api/src/modules/library/library.service.ts และ collections.service.ts) */

export type LibraryStatus = "reading" | "up_next" | "completed";
export type CollectionTint = "purple" | "coral" | "blue" | "orange" | "mint" | "pink";

export interface LibraryNovel {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  status: "ongoing" | "completed" | "hiatus";
  view_count: number;
  chapter_count: number;
  author: { user_id: string; username: string; pen_name: string | null };
}

export interface ReadingProgress {
  last_chapter_id: string | null;
  last_chapter_number: number;
  last_read_at: string;
}

export interface LibraryEntry {
  library_id: string;
  novel: LibraryNovel;
  added_at: string;
  status: LibraryStatus;
  progress: ReadingProgress | null;
  collection_ids: string[];
}

export interface LibraryCounts {
  all: number;
  reading: number;
  up_next: number;
  completed: number;
}

export interface ContinueReadingItem {
  novel: LibraryNovel;
  progress: ReadingProgress;
}

export interface Collection {
  collection_id: string;
  name: string;
  /** key ไอคอนชั้น (ดู lib/collectionIcons.ts) */
  icon: string | null;
  tint: CollectionTint;
  position: number;
  novels: LibraryNovel[];
}

export const libraryStatusLabel: Record<LibraryStatus, string> = {
  reading: "กำลังอ่าน",
  up_next: "อ่านต่อไป",
  completed: "อ่านจบแล้ว",
};

/** สีชั้นอะคริลิกเป็น "R G B" ใส่ใน CSS var --shelf (ใช้กับ rgb(var(--shelf) / α)) */
export const collectionTintRgb: Record<CollectionTint, string> = {
  purple: "167 139 250",
  coral: "251 146 120",
  blue: "96 165 250",
  orange: "240 128 60",
  mint: "52 211 153",
  pink: "244 114 182",
};

export const collectionTintLabel: Record<CollectionTint, string> = {
  purple: "ม่วง",
  coral: "ปะการัง",
  blue: "ฟ้า",
  orange: "ส้ม",
  mint: "มิ้นต์",
  pink: "ชมพู",
};

/** เพิ่มภายหลัง (perf) — ปกในคารูเซลสามมิติ (การ์ดกว้างสุด 240px, มือถือ 46vw) ให้ next/image เลือกไฟล์ขนาดพอดี
 *  แทนภาพต้นฉบับ 400x600 (ปกเดิมโหลดเต็มไฟล์ทุกใบผ่าน <img> ตรง ๆ) */
// ใช้ px ทั้งคู่ (การ์ดมือถือ clamp(150px, 46vw, 200px) ไม่เกิน 200px): ถ้ามี vw อยู่ใน sizes, next/image จะตัดตัวเลือก
// ขนาดที่เล็กกว่า 640 x vw ทิ้ง (46vw -> ต่ำสุด 384) ทำให้ได้ไฟล์ใหญ่เกินการ์ด 240px
export const CAROUSEL_COVER_SIZES = "(max-width: 767px) 200px, 240px";

export function coverOf(novel: Pick<LibraryNovel, "novel_id" | "cover_image_url">): string {
  return novel.cover_image_url ?? `https://picsum.photos/seed/${novel.novel_id}/400/600`;
}

/** % ความคืบหน้าจากตอนล่าสุดที่เปิด เทียบกับจำนวนตอนที่เผยแพร่ */
export function progressPercent(progress: ReadingProgress | null, chapterCount: number): number {
  if (!progress || chapterCount <= 0) return 0;
  return Math.min(100, Math.round((progress.last_chapter_number / chapterCount) * 100));
}

/** ลิงก์ "อ่านต่อ" — ตอนล่าสุดที่เปิด ถ้าไม่มี (เช่น ตอนถูกลบ) กลับไปหน้านิยาย */
export function continueHref(novelId: string, progress: ReadingProgress | null): string {
  return progress?.last_chapter_id ? `/novels/${novelId}/chapters/${progress.last_chapter_id}` : `/novels/${novelId}`;
}
