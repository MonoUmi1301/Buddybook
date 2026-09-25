import type { GiftAnimation, GiftTier } from "@prisma/client";

/** เพิ่มภายหลัง (Gift donations) — แคตตาล็อกของขวัญตั้งต้น ใช้ทั้ง seed.ts และเทสต์เช็คว่ารูปมีอยู่จริง
 *  (test/gift-assets.test.ts, scripts/check-gift-assets.ts) — ราคาแก้ทีหลังได้ผ่าน /admin/gifts (seed ไม่ทับ
 *  ราคา/สถานะที่แอดมินแก้แล้ว ดู seed.ts) รูปอยู่ที่ apps/web/public/donate/gifts/<slug>.png
 *  ต้องตรงกับ DONATE_ASSET_BASE ใน apps/web/src/lib/donate-assets.ts และอัปเดต ASSETS.md ทุกครั้งที่เพิ่ม slug */
export const GIFT_IMAGE_BASE = "/donate/gifts";

export interface GiftCatalogEntry {
  slug: string;
  name_th: string;
  name_en: string;
  description_th: string;
  price_coins: number;
  tier: GiftTier;
  animation: GiftAnimation;
}

export const giftCatalog: GiftCatalogEntry[] = [
  { slug: "coffee", name_th: "กาแฟ", name_en: "Coffee", description_th: "กาแฟหนึ่งแก้วให้ตาสว่างตอนปั่นต้นฉบับ", price_coins: 10, tier: "S", animation: "pop" },
  { slug: "cupcake", name_th: "คัพเค้ก", name_en: "Cupcake", description_th: "ขนมหวานชิ้นเล็กเป็นรางวัลหลังเขียนจบตอน", price_coins: 30, tier: "S", animation: "pop" },
  { slug: "chocolate", name_th: "ช็อกโกแลตกำลังใจ", name_en: "Chocolate", description_th: "ช็อกโกแลตแทนคำว่าสู้ ๆ นะ", price_coins: 40, tier: "S", animation: "pop" },
  { slug: "back-patch", name_th: "แผ่นแปะแก้ปวดหลัง", name_en: "Back Patch", description_th: "สำหรับนักเขียนที่นั่งนานจนหลังขอพัก", price_coins: 50, tier: "M", animation: "float" },
  { slug: "neck-pillow", name_th: "หมอนรองคอ", name_en: "Neck Pillow", description_th: "พักคอสักนิดก่อนเขียนตอนต่อไป", price_coins: 80, tier: "M", animation: "float" },
  { slug: "bluelight-glasses", name_th: "แว่นกรองแสง", name_en: "Blue-light Glasses", description_th: "ถนอมสายตาจากหน้าจอยามดึก", price_coins: 100, tier: "M", animation: "float" },
  { slug: "desk-plant", name_th: "ต้นไม้ตั้งโต๊ะ", name_en: "Desk Plant", description_th: "ต้นไม้เล็ก ๆ ให้โต๊ะเขียนหนังสือสดชื่น", price_coins: 150, tier: "L", animation: "float" },
  { slug: "keyboard", name_th: "คีย์บอร์ดน่ารัก", name_en: "Cute Keyboard", description_th: "คีย์บอร์ดใหม่ให้พิมพ์ได้ลื่นขึ้น", price_coins: 300, tier: "L", animation: "sparkle" },
  { slug: "massage-chair", name_th: "เก้าอี้นวด", name_en: "Massage Chair", description_th: "นวดคลายเมื่อยหลังเขียนมาทั้งวัน", price_coins: 500, tier: "L", animation: "sparkle" },
  { slug: "hug-bear", name_th: "ตุ๊กตาหมีกอดใจ", name_en: "Hug Bear", description_th: "กอดใหญ่ ๆ จากนักอ่านที่รอติดตามเสมอ", price_coins: 1000, tier: "XL", animation: "sparkle" },
];

/** slug ที่เคยอยู่ในแคตตาล็อกแต่ถอดออกแล้ว (ไม่มีไฟล์รูป — สเปกห้ามวาดรูปใหม่) seed.ts จะลบแถวนั้นทิ้ง
 *  ถ้ายังไม่มีใครเคยส่ง หรือปิดขายแทนถ้ามีประวัติการส่งแล้ว (ประวัติต้องอยู่) */
export const RETIRED_GIFT_SLUGS = ["matcha-latte"];

export function giftImageUrl(slug: string): string {
  return `${GIFT_IMAGE_BASE}/${slug}.png`;
}
