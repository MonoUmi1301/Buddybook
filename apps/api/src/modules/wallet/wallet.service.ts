import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { env } from "@/config/env";
import { verifySlip, transRefToUuid } from "@/lib/slipok";

type QueryClient = typeof prisma | Prisma.TransactionClient;

/** ยอด coin คงเหลือไม่ได้เก็บเป็นคอลัมน์แยกใน users — คำนวณจาก balance_after ของ
 *  wallet_transactions แถวล่าสุดของ user นั้นเสมอ (0 ถ้ายังไม่เคยมีธุรกรรม) */
export async function getBalance(user_id: string, client: QueryClient = prisma): Promise<number> {
  const latest = await client.walletTransaction.findFirst({
    where: { user_id },
    orderBy: { created_at: "desc" },
    select: { balance_after: true },
  });
  return latest ? latest.balance_after.toNumber() : 0;
}

/** Reference implementation — GET /wallet/transactions (เพิ่ม balance ปัจจุบันให้ด้วย
 *  นอกเหนือจาก spec เดิม เพื่อไม่ต้องให้ frontend คำนวณเองจาก array) */
export async function listTransactions(user_id: string) {
  const [transactions, balance] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { user_id },
      orderBy: { created_at: "desc" },
      select: { transaction_id: true, type: true, amount: true, balance_after: true, created_at: true },
    }),
    getBalance(user_id),
  ]);

  return { transactions, balance };
}

export const COIN_PACKAGES: Record<string, { coins: number; priceThb: number }> = {
  p25: { coins: 25, priceThb: 25 },
  p50: { coins: 50, priceThb: 50 },
  p100: { coins: 100, priceThb: 99 },
  p259: { coins: 259, priceThb: 250 },
  p410: { coins: 410, priceThb: 400 },
  p825: { coins: 825, priceThb: 800 },
};

/** Reference implementation — POST /wallet/topup/verify-slip (ส่วนขยายนอก API_Endpoints.md เดิม)
 *  slip_image_url มาจาก Cloudinary upload (ดู modules/uploads) — ตรวจสอบกับ SlipOK จริง แล้ว
 *  เช็คซ้ำอีก 3 ชั้น: (1) ยอดเงินต้องตรงราคาแพ็กเกจเป๊ะ (2) บัญชีปลายทางต้องตรงกับระบบ (ถ้าตั้งค่าไว้)
 *  (3) transRef ต้องไม่เคยถูกใช้มาก่อน (กันสลิปเดิมมาเติมซ้ำหลายรอบ)
 *
 *  บั๊กเดิม (audit fix): การเช็ค existing → อ่าน balance → create เป็น 3 round-trip แยกกันโดยไม่มี
 *  transaction ห่อ ทำให้ยิง request ซ้ำพร้อมกันด้วยสลิปเดิม (replay) แข่งกันผ่านเช็ค existing ได้ทั้งคู่
 *  ก่อนที่แถวแรกจะถูก insert จริง (classic TOCTOU) → เติมเงินซ้ำสำเร็จทั้งสอง request เกราะป้องกันจริง
 *  คือ unique constraint ระดับ DB บน (type, reference_id) (ดู schema.prisma) ไม่ใช่แค่ findFirst เฉย ๆ
 *  — ห่อด้วย $transaction เพื่อให้ balance_after คำนวณจาก balance ล่าสุดจริง ๆ ณ ขณะ insert แล้วจับ
 *  P2002 เป็นชั้นป้องกันสุดท้ายถ้า race หลุดผ่าน pre-check ด้านบนมาได้ */
export async function verifyTopupSlip(user_id: string, packageId: string, slipImageUrl: string) {
  const pkg = COIN_PACKAGES[packageId];
  if (!pkg) throw ApiError.badRequest("Invalid package_id");

  const result = await verifySlip(slipImageUrl);

  if (Math.abs(result.amount - pkg.priceThb) > 0.01) {
    throw ApiError.unprocessable(
      `จำนวนเงินในสลิป (${result.amount} บาท) ไม่ตรงกับแพ็กเกจที่เลือก (${pkg.priceThb} บาท)`
    );
  }

  if (env.PAYMENT_RECEIVING_ACCOUNT && result.receivingBankAccount !== env.PAYMENT_RECEIVING_ACCOUNT) {
    throw ApiError.unprocessable("บัญชีปลายทางในสลิปไม่ตรงกับบัญชีของระบบ");
  }

  const referenceId = transRefToUuid(result.transRef);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.walletTransaction.findFirst({
        where: { type: "topup", reference_id: referenceId },
      });
      if (existing) throw ApiError.conflict("สลิปนี้ถูกใช้เติมเงินไปแล้ว");

      const currentBalance = await getBalance(user_id, tx);

      return tx.walletTransaction.create({
        data: {
          user_id,
          type: "topup",
          amount: pkg.coins,
          balance_after: currentBalance + pkg.coins,
          reference_id: referenceId,
        },
        select: { transaction_id: true, type: true, amount: true, balance_after: true, created_at: true },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("สลิปนี้ถูกใช้เติมเงินไปแล้ว");
    }
    throw err;
  }
}
