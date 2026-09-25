/**
 * เพิ่มภายหลัง (Gift donations) — path ของรูปทั้งหมดในระบบของขวัญอยู่ที่ไฟล์นี้ที่เดียว ห้าม hard-code ที่อื่น
 * ไฟล์จริงอยู่ที่ apps/web/public/donate/ (ดู ASSETS.md ในโฟลเดอร์นั้น) — ต้องตรงกับ GIFT_IMAGE_BASE
 * ใน apps/api/prisma/gift-catalog.ts
 */
export const DONATE_ASSET_BASE = "/donate";

export const MASCOT_IMAGE = `${DONATE_ASSET_BASE}/mascot/mascot-bear.png`;

/** รูปของขวัญตาม GiftItem.slug (PNG 512x512 พื้นใส มีเส้นขอบสติกเกอร์ในตัว) */
export function giftImage(slug: string): string {
  return `${DONATE_ASSET_BASE}/gifts/${slug}.png`;
}

export const GIFT_IMAGE_SIZE = 512;

export type CardTemplate = "stamp" | "matcha" | "navy" | "bear";

export const CARD_TEMPLATES: readonly CardTemplate[] = ["stamp", "matcha", "navy", "bear"];

/** ใช้กับ onError ของ next/image — สลับเป็นรูปมาสคอตถ้ารูปของขวัญหาย และเตือนเฉพาะตอน dev */
export function fallbackToMascot(slug: string): string {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[donate-assets] missing gift image for "${slug}" (${giftImage(slug)}), using mascot instead`);
  }
  return MASCOT_IMAGE;
}
