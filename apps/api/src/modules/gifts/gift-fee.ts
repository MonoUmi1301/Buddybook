/**
 * เพิ่มภายหลัง (Gift donations) — แบ่งยอดของขวัญเป็นค่าธรรมเนียมแพลตฟอร์ม + ส่วนที่นักเขียนได้
 * ค่าธรรมเนียมปัดเศษลงเป็น coin เต็ม (ส่วนที่ปัดทิ้งตกเป็นของนักเขียน) ค่าธรรมเนียมยังไม่เข้ากระเป๋า
 * ใคร — บันทึกไว้ที่ donations.fee_amount เท่านั้น (ยังไม่มีบัญชีแพลตฟอร์มใน ledger)
 */
export function splitGiftFee(grossCoins: number, feePercent: number): { fee: number; net: number } {
  if (!Number.isInteger(grossCoins) || grossCoins <= 0) {
    throw new RangeError(`grossCoins must be a positive integer, got ${grossCoins}`);
  }
  if (feePercent < 0 || feePercent > 100) {
    throw new RangeError(`feePercent must be between 0 and 100, got ${feePercent}`);
  }
  // คูณเป็นหน่วยย่อยก่อนหารกันทศนิยมลอยตัว (เช่น 10.5% ของ 200 ต้องได้ 21 ไม่ใช่ 20.999...)
  const fee = Math.floor((grossCoins * Math.round(feePercent * 100)) / 10000);
  return { fee, net: grossCoins - fee };
}
