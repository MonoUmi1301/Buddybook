import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { env } from "@/config/env";
import { verifySlip, transRefToUuid } from "@/lib/slipok";
import { getStripeClient } from "@/lib/stripe";
import { stringToUuid } from "@/lib/idHash";
import { resolveOrderStatus } from "@/lib/payments/resolveStatus";

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

/** เพิ่มภายหลัง (perf/safety) — ขอบเขตเวลาของทุก transaction ที่แตะกระเป๋าเงิน (ค่า default ของ Prisma คือ
 *  maxWait 2 วิ / timeout 5 วิ) ระบุให้ชัด: รอ connection ได้ 5 วิ, ทั้ง transaction (รวมรอ advisory lock) ไม่เกิน
 *  10 วิ เท่ากับ lock_timeout ของ DB (ดู migration connection_guards) — เกินแล้ว Prisma rollback ทั้งก้อน
 *  ไม่มีการหักเงินครึ่งทาง */
export const WALLET_TX_OPTIONS = { maxWait: 5000, timeout: 10000 } as const;

/** namespace ของ advisory lock กระเป๋าเงิน (key แรกของ pg_advisory_xact_lock(int, int)) กันชนกับ
 *  advisory lock อื่นที่อาจเพิ่มในอนาคต */
const WALLET_LOCK_NAMESPACE = 7310;

/** เพิ่มภายหลัง (Gift donations, audit fix) — ต้องเรียกเป็นอย่างแรกในทุก transaction ที่จะเขียน
 *  wallet_transactions ก่อน getBalance เสมอ
 *
 *  บั๊กเดิม: อ่าน balance แล้วค่อย insert โดยไม่มี lock → สอง request พร้อมกัน (กดส่งซ้ำ, สองแท็บ,
 *  โดเนทชนกับ webhook เติมเงิน) อ่านยอดเดิมได้ทั้งคู่ → ใช้เงินเกินยอดหรือยอดเติมหาย ส่วน unique
 *  (type, reference_id) ช่วยไม่ได้เพราะ reference_id ของแต่ละรายการต่างกัน
 *
 *  advisory lock ระดับ transaction (ปลดเองตอน commit/rollback) ต่อ user_id — เรียงก่อนล็อกเสมอ
 *  เพื่อให้สองรายการที่โอนสวนทางกัน (A→B กับ B→A) ล็อกลำดับเดียวกัน ไม่ deadlock */
export async function lockWallets(tx: Prisma.TransactionClient, user_ids: string[]): Promise<void> {
  for (const id of [...new Set(user_ids)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${WALLET_LOCK_NAMESPACE}::int, hashtext(${id}))`;
  }
}

/** created_at ของแถว ledger ที่เขียนหลัง lockWallets — ห้ามพึ่ง DEFAULT now() ของ Postgres เพราะเป็น
 *  เวลา "เริ่ม" transaction: รายการที่เริ่มก่อนแต่ได้ lock ทีหลังจะได้ created_at เก่ากว่าแถวที่เขียนไป
 *  แล้ว ทำให้ getBalance (เรียงตาม created_at) หยิบยอดผิดแถว — ใช้เวลาจริง ณ ตอนเขียนแทน */
export function ledgerTimestamp(): Date {
  return new Date();
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

      await lockWallets(tx, [user_id]);
      const currentBalance = await getBalance(user_id, tx);

      return tx.walletTransaction.create({
        data: {
          user_id,
          type: "topup",
          amount: pkg.coins,
          balance_after: currentBalance + pkg.coins,
          reference_id: referenceId,
          created_at: ledgerTimestamp(),
        },
        select: { transaction_id: true, type: true, amount: true, balance_after: true, created_at: true },
      });
    }, WALLET_TX_OPTIONS);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("สลิปนี้ถูกใช้เติมเงินไปแล้ว");
    }
    throw err;
  }
}

/** เพิ่มภายหลัง (audit fix — เปลี่ยนจาก SlipOK/อัปโหลดสลิปมาใช้ Stripe) — POST /wallet/topup/checkout-session
 *  สร้าง Checkout Session แบบ embedded (ฝังฟอร์มจ่ายเงินในหน้าเว็บเราเอง) ส่ง price_data inline ทุกครั้ง
 *  ให้ COIN_PACKAGES เป็นแหล่งความจริงราคาเดียว และสร้างแถว topup_orders คู่กันเป็นแหล่งความจริงของ
 *  สถานะ/วันหมดอายุ — return_url พา order_id กลับมาให้หน้า /wallet เช็คสถานะจาก DB ของเรา */
export async function createStripeCheckoutSession(user_id: string, packageId: string) {
  const pkg = COIN_PACKAGES[packageId];
  if (!pkg) throw ApiError.badRequest("Invalid package_id");

  const order_id = crypto.randomUUID();
  // Stripe expires_at เป็น UNIX วินาที (ช่วงที่อนุญาต 30 นาที–24 ชม.) — 30 นาทีคือค่าต่ำสุด ให้ session
  // ที่ผู้ใช้ทิ้งไว้ไม่จ่ายกลายเป็น expired ได้ไวพอจะบอกผู้ใช้ได้จริง
  const expiresAtSec = Math.floor(Date.now() / 1000) + 30 * 60;

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "thb",
          product_data: { name: `เติม ${pkg.coins} coin เข้า BuddyBook` },
          // Stripe รับหน่วยเป็นสตางค์ — THB ไม่ใช่สกุลเงิน zero-decimal จึงต้องคูณ 100 เสมอ
          unit_amount: Math.round(pkg.priceThb * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { user_id, package_id: packageId, order_id },
    return_url: `${env.APP_URL}/wallet?topup_order=${order_id}`,
    expires_at: expiresAtSec,
  });

  try {
    await prisma.topupOrder.create({
      data: {
        order_id,
        user_id,
        stripe_session_id: session.id,
        package_id: packageId,
        coins: pkg.coins,
        amount_thb: pkg.priceThb,
        expires_at: new Date(expiresAtSec * 1000),
      },
    });
  } catch (err) {
    // บันทึก order ไม่ได้ = ห้ามปล่อยให้จ่ายเงินได้ (ไม่มีที่บันทึกผล) — ปิด session ทิ้งก่อนแจ้ง error
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    throw err;
  }

  return { client_secret: session.client_secret, order_id, expires_at: new Date(expiresAtSec * 1000) };
}

/** GET /wallet/topup/orders/:order_id/status (requireAuth) — อ่านสถานะจาก topup_orders เท่านั้น
 *  (ไม่เรียก Stripe และไม่เติม coin — webhook เป็นคนเดียวที่เปลี่ยนสถานะ/เติม coin) */
export async function getTopupOrderStatus(user_id: string, order_id: string) {
  const order = await prisma.topupOrder.findUnique({ where: { order_id } });
  // ของคนอื่นตอบ 404 เหมือนไม่มีอยู่ — กันเดา order_id ของคนอื่นมาดู
  if (!order || order.user_id !== user_id) throw ApiError.notFound("Top-up order not found");
  return {
    order_id,
    status: resolveOrderStatus(order),
    coins: order.coins,
    expires_at: order.expires_at,
  };
}

/** webhook: checkout.session.completed (+ paid) / async_payment_succeeded — เติม coin ครั้งเดียวต่อ session
 *  idempotent 2 ชั้น: order ต้องยัง pending (updateMany เงื่อนไข status) + unique (type, reference_id)
 *  ของ wallet_transactions — Stripe ส่ง event ซ้ำ หรือสองแท็บ/สอง event มาพร้อมกันก็ไม่เติมซ้ำ */
export async function fulfillStripeTopup(session: Stripe.Checkout.Session): Promise<void> {
  const order = await prisma.topupOrder.findUnique({ where: { stripe_session_id: session.id } });
  const user_id = order?.user_id ?? session.metadata?.user_id;
  const packageId = order?.package_id ?? session.metadata?.package_id;
  if (!user_id || !packageId) {
    console.error(`Stripe webhook: no order/metadata for session ${session.id}`);
    return;
  }
  const pkg = COIN_PACKAGES[packageId];
  if (!pkg) {
    console.error(`Stripe webhook: unknown package_id "${packageId}" on session ${session.id}`);
    return;
  }
  const coins = order?.coins ?? pkg.coins;
  if (session.amount_total !== null && session.amount_total !== Math.round(Number(order?.amount_thb ?? pkg.priceThb) * 100)) {
    console.error(`Stripe webhook: amount mismatch on session ${session.id} (${session.amount_total})`);
    return;
  }

  const referenceId = stringToUuid(session.id);
  try {
    await prisma.$transaction(async (tx) => {
      if (order) {
        const claimed = await tx.topupOrder.updateMany({
          where: { order_id: order.order_id, status: { not: "paid" } },
          data: { status: "paid", paid_at: new Date(), failed_at: null },
        });
        if (claimed.count === 0) return; // จ่ายแล้ว/เติมไปแล้ว
      }
      const existing = await tx.walletTransaction.findFirst({ where: { type: "topup", reference_id: referenceId } });
      if (existing) return;

      await lockWallets(tx, [user_id]);
      const currentBalance = await getBalance(user_id, tx);
      await tx.walletTransaction.create({
        data: {
          user_id,
          type: "topup",
          amount: coins,
          balance_after: currentBalance + coins,
          reference_id: referenceId,
          created_at: ledgerTimestamp(),
        },
      });
    }, WALLET_TX_OPTIONS);
  } catch (err) {
    // มีอีก request เติมไปแล้วพร้อมกัน (unique ชน) — ถือว่าสำเร็จ ไม่เติมซ้ำ
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
}

/** webhook: checkout.session.expired / async_payment_failed — ปิด order เป็น failed (ไม่แตะ order ที่จ่ายแล้ว) */
export async function failStripeTopup(session: Stripe.Checkout.Session): Promise<void> {
  await prisma.topupOrder.updateMany({
    where: { stripe_session_id: session.id, status: "pending" },
    data: { status: "failed", failed_at: new Date() },
  });
}
