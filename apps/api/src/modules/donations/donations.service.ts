import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { getBalance } from "@/modules/wallet/wallet.service";

interface CreateDonationInput {
  to_user_id: string;
  novel_id?: string;
  amount: number;
  message?: string;
}

/**
 * Reference implementation — POST /donations
 * โอน coin จริงระหว่าง user สองคนภายในระบบ (ไม่ใช่เงินจริง — coin ซื้อมาจาก top-up ที่ผ่าน SlipOK
 * แล้ว) บันทึกเป็นคู่ wallet_transactions (donation_sent ฝั่งผู้ให้ / donation_received ฝั่งผู้รับ)
 * ในทรานแซกชันเดียวกับ donations row เพื่อไม่ให้ยอด balance เพี้ยนถ้าอันใดอันหนึ่ง fail กลางทาง
 */
export async function createDonation(from_user_id: string, input: CreateDonationInput) {
  if (input.to_user_id === from_user_id) {
    throw ApiError.badRequest("Cannot donate to yourself");
  }

  const toUser = await prisma.user.findUnique({ where: { user_id: input.to_user_id }, select: { user_id: true } });
  if (!toUser) throw ApiError.notFound("Recipient not found");

  if (input.novel_id) {
    const novel = await prisma.novel.findUnique({ where: { novel_id: input.novel_id }, select: { novel_id: true } });
    if (!novel) throw ApiError.notFound("Novel not found");
  }

  return prisma.$transaction(async (tx) => {
    const senderBalance = await getBalance(from_user_id, tx);
    if (senderBalance < input.amount) {
      throw ApiError.unprocessable("Insufficient coin balance");
    }

    const donation = await tx.donation.create({
      data: {
        novel_id: input.novel_id,
        from_user_id,
        to_user_id: input.to_user_id,
        amount: input.amount,
        message: input.message,
      },
      select: { donation_id: true, amount: true, created_at: true },
    });

    await tx.walletTransaction.create({
      data: {
        user_id: from_user_id,
        type: "donation_sent",
        amount: input.amount,
        balance_after: senderBalance - input.amount,
        reference_id: donation.donation_id,
      },
    });

    const receiverBalance = await getBalance(input.to_user_id, tx);
    await tx.walletTransaction.create({
      data: {
        user_id: input.to_user_id,
        type: "donation_received",
        amount: input.amount,
        balance_after: receiverBalance + input.amount,
        reference_id: donation.donation_id,
      },
    });

    await tx.notification.create({
      data: {
        user_id: input.to_user_id,
        type: "donation",
        content: `คุณได้รับโดเนท ${input.amount} coin`,
        link_url: input.novel_id ? `/novels/${input.novel_id}` : null,
      },
    });

    return donation;
  });
}
