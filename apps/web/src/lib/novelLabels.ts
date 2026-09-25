export type NovelStatus = "ongoing" | "completed" | "hiatus";
export type LegalStatus = "original" | "fan-fiction" | "translation";
export type ContentRating = "all_ages" | "teen" | "mature";

export const novelStatusLabel: Record<NovelStatus, string> = {
  ongoing: "กำลังเขียน",
  completed: "จบแล้ว",
  hiatus: "พักการเขียน",
};

/** พื้นโปร่ง (/10) ใช้ได้ทั้งธีมสว่าง/มืด — class เต็มคงที่เพราะ Tailwind JIT ต้องเห็น class ตรง ๆ */
export const novelStatusClasses: Record<NovelStatus, string> = {
  ongoing: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/30",
  completed: "bg-primary-500/10 text-primary-600 ring-primary-500/30",
  hiatus: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

export const legalStatusLabel: Record<LegalStatus, string> = {
  original: "ต้นฉบับ",
  "fan-fiction": "แฟนฟิค",
  translation: "แปล",
};

export const contentRatingLabel: Record<ContentRating, string> = {
  all_ages: "ทุกวัย",
  teen: "13+",
  mature: "18+",
};

export const contentRatingClasses: Record<ContentRating, string> = {
  all_ages: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  teen: "bg-amber-500/10 text-amber-600 ring-amber-500/30",
  mature: "bg-red-500/10 text-red-600 ring-red-500/30",
};
