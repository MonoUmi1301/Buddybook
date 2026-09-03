import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { env } from "@/config/env";
import { verifySlip, transRefToUuid } from "@/lib/slipok";
import { getStripeClient } from "@/lib/stripe";
import { stringToUuid } from "@/lib/idHash";

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

/** เพิ่มภายหลัง (audit fix — เปลี่ยนจาก SlipOK/อัปโหลดสลิปมาใช้ Stripe) — POST /wallet/topup/checkout-session
 *  สร้าง Checkout Session แบบ ui_mode: "embedded_page" (ฝังฟอร์มจ่ายเงินในหน้าเว็บเราเอง ไม่เด้งออกไปเว็บ
 *  Stripe) ไม่สร้าง Product/Price ล่วงหน้าใน Stripe Dashboard — ส่ง price_data inline ทุกครั้งแทน
 *  เพื่อให้ COIN_PACKAGES ในไฟล์นี้ยังเป็นแหล่งความจริงราคาเดียว (ไม่ต้องซิงก์ราคากับ Stripe เองอีกที่)
 *  ผูก user_id/package_id ไว้ใน metadata เพื่อให้ webhook (creditStripeTopup) รู้ว่าจะเติมให้ใคร/เท่าไหร่
 *  ตอน checkout.session.completed ยิงกลับมา */
export async function createStripeCheckoutSession(user_id: string, packageId: string) {
  const pkg = COIN_PACKAGES[packageId];
  if (!pkg) throw ApiError.badRequest("Invalid package_id");

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "thb",
          product_data: { name: `เติม ${pkg.coins} coin เข้า BuddyBook` },
          // Stripe รับหน่วยเป็นสตางค์ (หน่วยย่อยสุดของสกุลเงิน) ไม่ใช่บาทตรง ๆ — THB ไม่ใช่สกุลเงิน
          // zero-decimal ของ Stripe จึงต้องคูณ 100 เสมอ
          unit_amount: Math.round(pkg.priceThb * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { user_id, package_id: packageId },
    return_url: `${env.APP_URL}/wallet?checkout_session_id={CHECKOUT_SESSION_ID}`,
    // 30 นาที (ค่าต่ำสุดที่ Stripe อนุญาต) แทนค่า default 24 ชม. — ให้ session ที่ผู้ใช้ทิ้งไว้ไม่จ่าย
    // (เช่น เปิด PromptPay QR ค้างไว้แล้วไม่จ่าย) กลายเป็นสถานะ "expired" ได้ไวพอจะบอกผู้ใช้ได้จริง
    // ว่ารายการนี้ไม่สำเร็จ ไม่ใช่ปล่อยค้างเป็นวันเหมือน default
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });

  return { client_secret: session.client_secret, session_id: session.id };
}

/** GET /wallet/topup/checkout-session/:id/status (requireAuth) — เอาไว้ให้ frontend เช็คสถานะ
 *  session เจาะจงตัวเองได้ ตอนที่ poll ยอด balance สั้น ๆ ครบรอบแล้วยังไม่เจอเงินเข้า (ดู
 *  WalletContent.tsx) เพื่อแยกให้ออกว่า "ยังไม่จ่าย/กำลังรอ" (status: open) กับ "รายการหมดอายุ/
 *  ไม่สำเร็จจริง ๆ" (status: expired) เพราะสองเคสนี้ความหมายกับผู้ใช้ต่างกันมาก เช็ค metadata.user_id
 *  เทียบกับ user ที่ล็อกอินอยู่ก่อนเสมอ กัน user คนอื่นเดา session id คนอื่นมาเช็คสถานะได้ */
export async function getStripeCheckoutSessionStatus(user_id: string, sessionId: string) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.metadata?.user_id !== user_id) {
    throw ApiError.notFound("Checkout session not found");
  }

  return { status: session.status, payment_status: session.payment_status };
}

/** เรียกจาก webhook handler ตอน checkout.session.completed เท่านั้น (ไม่ใช่ endpoint ที่ frontend
 *  เรียกตรง ๆ) — ต้อง idempotent เพราะ Stripe อาจส่ง webhook event ซ้ำได้ (retry ตอนเราตอบช้า/พลาด)
 *  ใช้ pattern เดียวกับ verifyTopupSlip เป๊ะ ๆ: unique constraint (type, reference_id) ระดับ DB เป็น
 *  เกราะป้องกันจริง ไม่ใช่แค่ findFirst — ต่างกันแค่ตรงนี้ไม่ throw ตอนเจอรายการซ้ำ (เพราะไม่มี client
 *  รออยู่ปลายทางที่ต้องได้ error response กลับไป แค่ต้องไม่เติมเงินซ้ำเงียบ ๆ ก็พอ) */
export async function creditStripeTopup(session: Stripe.Checkout.Session): Promise<void> {
  const user_id = session.metadata?.user_id;
  const packageId = session.metadata?.package_id;
  if (!user_id || !packageId) {
    console.error(`Stripe webhook: missing metadata on session ${session.id}`);
    return;
  }

  const pkg = COIN_PACKAGES[packageId];
  if (!pkg) {
    console.error(`Stripe webhook: unknown package_id "${packageId}" on session ${session.id}`);
    return;
  }

  const referenceId = stringToUuid(session.id);

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.walletTransaction.findFirst({
        where: { type: "topup", reference_id: referenceId },
      });
      if (existing) return;

      const currentBalance = await getBalance(user_id, tx);

      await tx.walletTransaction.create({
        data: {
          user_id,
          type: "topup",
          amount: pkg.coins,
          balance_after: currentBalance + pkg.coins,
          reference_id: referenceId,
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return;
    }
    throw err;
  }
}
