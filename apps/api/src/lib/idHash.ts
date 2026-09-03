import crypto from "node:crypto";

/** แปลงสตริงอ้างอิงธุรกรรม (transRef ของ SlipOK, session id ของ Stripe ฯลฯ ซึ่งไม่ใช่ UUID)
 *  เป็น UUID-shape แบบ deterministic เพื่อเก็บใน wallet_transactions.reference_id (คอลัมน์เป็น
 *  @db.Uuid) — สตริงเดิมได้ค่าเดิมเสมอ จึงใช้เช็คกันธุรกรรมเดิมถูกใช้ซ้ำได้ (ผ่าน unique constraint
 *  (type, reference_id) โดยไม่ต้องแก้ schema เพิ่มคอลัมน์ text แยกต่างหาก) ใช้ร่วมกันได้ทุกช่องทาง
 *  ชำระเงิน ไม่ใช่แค่ SlipOK — ย้ายมาจาก lib/slipok.ts ตอนเพิ่ม Stripe เข้ามา */
export function stringToUuid(value: string): string {
  const hash = crypto.createHash("sha1").update(value).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
