/**
 * เพิ่มภายหลัง (Gift donations) — ป้ายผู้สนับสนุนบนโปรไฟล์นักอ่าน แก้/เพิ่มเกณฑ์ได้ที่นี่ที่เดียว
 * นับเฉพาะของขวัญที่ส่งแบบระบุตัวตน (is_anonymous = false) และไม่ถูกซ่อน — ของที่ตั้งใจส่งแบบนิรนาม
 * ต้องไม่ถูกเปิดเผยทางอ้อมผ่านป้าย
 * image_slug = รูปของขวัญที่ใช้เป็นไอคอนป้าย (ไม่ใช้อีโมจิ) — ไม่มีก็แสดงเป็นป้ายข้อความเฉย ๆ
 */
export interface SupporterBadgeRule {
  id: string;
  label: string;
  description_th: string;
  image_slug?: string;
  /** นับรวมจำนวนชิ้นของขวัญ slug เหล่านี้ */
  gift_slugs?: string[];
  min_quantity?: number;
  /** หรือยอดคอยน์ที่ส่งรวม (รวม Custom coins) */
  min_total_coins?: number;
}

export const SUPPORTER_BADGES: readonly SupporterBadgeRule[] = [
  {
    id: "coffee-buddy",
    label: "Coffee Buddy",
    description_th: "ส่งกาแฟให้นักเขียนครบ 10 แก้ว",
    image_slug: "coffee",
    gift_slugs: ["coffee"],
    min_quantity: 10,
  },
  {
    id: "sweet-supporter",
    label: "Sweet Supporter",
    description_th: "ส่งคัพเค้กหรือช็อกโกแลตรวม 10 ชิ้น",
    image_slug: "cupcake",
    gift_slugs: ["cupcake", "chocolate"],
    min_quantity: 10,
  },
  {
    id: "big-hugger",
    label: "Big Hugger",
    description_th: "ส่งตุ๊กตาหมีกอดใจให้นักเขียนแล้ว",
    image_slug: "hug-bear",
    gift_slugs: ["hug-bear"],
    min_quantity: 1,
  },
  {
    id: "patron",
    label: "Patron",
    description_th: "สนับสนุนนักเขียนรวม 1,000 คอยน์ขึ้นไป",
    min_total_coins: 1000,
  },
];
