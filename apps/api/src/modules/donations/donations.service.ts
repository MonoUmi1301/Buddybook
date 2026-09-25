import { LEGACY_DONATION_MESSAGE_MAX, sendGift } from "@/modules/gifts/gifts.service";

interface CreateDonationInput {
  to_user_id: string;
  novel_id?: string;
  amount: number;
  message?: string;
  idempotency_key?: string;
}

/**
 * Reference implementation — POST /donations
 * โอน coin จริงระหว่าง user สองคนภายในระบบ (ไม่ใช่เงินจริง — coin ซื้อมาจาก top-up)
 *
 * เปลี่ยนภายหลัง (Gift donations) — เดิมมี logic หักเงิน/ledger/แจ้งเตือนของตัวเองที่อ่านยอดโดยไม่ล็อก
 * (สองรายการพร้อมกันใช้เงินเกินยอดได้) ตอนนี้วิ่งผ่าน sendGift ตัวเดียวกับของขวัญในโหมด
 * "Custom coins" (gift_id = null, ไม่หักค่าธรรมเนียม) เพื่อไม่ให้สองเส้นทางนี้แยกกันไปคนละทาง
 * รูปแบบ request/response เดิมยังใช้ได้ (response มีฟิลด์เพิ่ม ไม่ได้ลบของเดิม)
 */
export async function createDonation(from_user_id: string, input: CreateDonationInput) {
  const result = await sendGift(from_user_id, {
    author_id: input.to_user_id,
    novel_id: input.novel_id,
    custom_coins: input.amount,
    card: input.message ? { message: input.message } : undefined,
    idempotency_key: input.idempotency_key,
    message_max: LEGACY_DONATION_MESSAGE_MAX,
  });
  return result.donation;
}
