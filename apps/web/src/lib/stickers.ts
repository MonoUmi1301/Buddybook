/** สติกเกอร์ที่ใช้ได้ในคอมเมนต์/รีวิว — ไฟล์อยู่ที่ public/sticker/<id>.png
 *  id ต้องตรงกับ STICKER_IDS ใน apps/api/src/lib/stickers.ts (backend validate ด้วย z.enum) */
export const STICKERS = [
  { id: "joyful", label: "สนุกมากเลย!" },
  { id: "funny", label: "ขำก๊ากกกก" },
  { id: "fluffy", label: "ฟินนน~" },
  { id: "amhere", label: "มาแล้วจ้าา" },
  { id: "sosad", label: "หมอนเปียกน้ำตา" },
] as const;

export type StickerId = (typeof STICKERS)[number]["id"];

export const STICKER_IDS = STICKERS.map((s) => s.id) as [StickerId, ...StickerId[]];

export function stickerSrc(id: string): string {
  return `/sticker/${id}.png`;
}

export function findSticker(id: string | null | undefined) {
  return STICKERS.find((s) => s.id === id);
}
