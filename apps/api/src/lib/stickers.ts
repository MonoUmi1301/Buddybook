/** สติกเกอร์ที่ใช้ได้ในคอมเมนต์/รีวิว — ต้องตรงกับไฟล์ใน apps/web/public/sticker/<id>.png
 *  และรายการใน apps/web/src/lib/stickers.ts */
export const STICKER_IDS = ["joyful", "funny", "fluffy", "amhere", "sosad"] as const;

export type StickerId = (typeof STICKER_IDS)[number];
