import { Prisma } from "@prisma/client";
import type { WalletTxType, WithdrawalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import { getBalance, ledgerTimestamp, lockWallets, WALLET_TX_OPTIONS } from "@/modules/wallet/wallet.service";

/**
 * เพิ่มภายหลัง (ถอนรายได้นักเขียน) — นักเขียนขอถอน coin ที่ "หามาได้" (ของขวัญที่ได้รับ + ส่วนแบ่งขายตอน)
 * เป็นเงินบาท coin ถูกหักทันทีตอนขอ (แถว ledger type=withdrawal) กันเอาไปใช้ซ้ำระหว่างรอ แอดมินโอนเงินจริง
 * นอกระบบแล้วกด paid หรือ rejected (คืน coin ด้วยแถว withdrawal_refund) ขอได้ทีละ 1 รายการที่ยังรอ
 *
 * ถอนได้ไม่เกิน min(ยอดคงเหลือ, รายได้สะสม − ที่ถอนไปแล้วสุทธิ) — coin ที่เติมเองด้วยบัตร/PromptPay ถอนไม่ได้
 * (กันใช้ระบบเป็นช่องทางแลกเงินเข้า-ออก)
 */

type QueryClient = typeof prisma | Prisma.TransactionClient;

const EARNING_TYPES: WalletTxType[] = ["donation_received", "chapter_sale"];

async function sumByType(user_id: string, types: WalletTxType[], client: QueryClient) {
  const rows = await client.walletTransaction.groupBy({
    by: ["type"],
    where: { user_id, type: { in: types } },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.type, r._sum.amount?.toNumber() ?? 0]));
}

export async function getWithdrawableSummary(user_id: string, client: QueryClient = prisma) {
  const [balance, sums] = await Promise.all([
    getBalance(user_id, client),
    sumByType(user_id, [...EARNING_TYPES, "withdrawal", "withdrawal_refund"], client),
  ]);
  const earned = EARNING_TYPES.reduce((acc, t) => acc + (sums.get(t) ?? 0), 0);
  const withdrawn = (sums.get("withdrawal") ?? 0) - (sums.get("withdrawal_refund") ?? 0);
  const withdrawable = Math.max(0, Math.floor(Math.min(balance, earned - withdrawn)));
  return {
    balance,
    total_earned: earned,
    total_withdrawn: withdrawn,
    withdrawable_coins: withdrawable,
    min_withdrawal_coins: env.WITHDRAWAL_MIN_COINS,
    coin_to_thb_rate: env.COIN_TO_THB_RATE,
  };
}

const withdrawalSelect = {
  withdrawal_id: true,
  amount_coins: true,
  amount_thb: true,
  payout_method: true,
  account_name: true,
  account_number: true,
  bank_name: true,
  status: true,
  admin_note: true,
  processed_at: true,
  created_at: true,
} satisfies Prisma.WithdrawalRequestSelect;

type WithdrawalRow = Prisma.WithdrawalRequestGetPayload<{ select: typeof withdrawalSelect }>;

function serialize(row: WithdrawalRow) {
  return { ...row, amount_thb: row.amount_thb.toNumber() };
}

/** GET /wallet/withdrawals — ประวัติคำขอ + ยอดที่ถอนได้ */
export async function listMyWithdrawals(user_id: string) {
  const [rows, summary] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      where: { user_id },
      orderBy: { created_at: "desc" },
      take: 50,
      select: withdrawalSelect,
    }),
    getWithdrawableSummary(user_id),
  ]);
  return { withdrawals: rows.map(serialize), ...summary };
}

export interface CreateWithdrawalInput {
  amount_coins: number;
  payout_method: "promptpay" | "bank";
  account_name: string;
  account_number: string;
  bank_name?: string;
}

/** POST /wallet/withdrawals */
export async function requestWithdrawal(user_id: string, input: CreateWithdrawalInput) {
  if (input.amount_coins < env.WITHDRAWAL_MIN_COINS) {
    throw ApiError.unprocessable(`ถอนขั้นต่ำ ${env.WITHDRAWAL_MIN_COINS} คอยน์`);
  }

  const created = await prisma.$transaction(async (tx) => {
    await lockWallets(tx, [user_id]);

    const pending = await tx.withdrawalRequest.count({ where: { user_id, status: "pending" } });
    if (pending > 0) throw ApiError.conflict("มีคำขอถอนที่รอดำเนินการอยู่แล้ว");

    const summary = await getWithdrawableSummary(user_id, tx);
    if (input.amount_coins > summary.withdrawable_coins) {
      throw ApiError.unprocessable("ยอดที่ถอนได้ไม่พอ", {
        withdrawable_coins: summary.withdrawable_coins,
        requested: input.amount_coins,
      });
    }

    const row = await tx.withdrawalRequest.create({
      data: {
        user_id,
        amount_coins: input.amount_coins,
        amount_thb: new Prisma.Decimal(input.amount_coins).mul(env.COIN_TO_THB_RATE).toDecimalPlaces(2),
        payout_method: input.payout_method,
        account_name: input.account_name,
        account_number: input.account_number,
        bank_name: input.payout_method === "bank" ? input.bank_name ?? null : null,
      },
      select: withdrawalSelect,
    });

    await tx.walletTransaction.create({
      data: {
        user_id,
        type: "withdrawal",
        amount: input.amount_coins,
        balance_after: summary.balance - input.amount_coins,
        reference_id: row.withdrawal_id,
        created_at: ledgerTimestamp(),
      },
    });

    return row;
  }, WALLET_TX_OPTIONS);

  return serialize(created);
}

/** GET /admin/withdrawals?status=pending */
export async function adminListWithdrawals(status: WithdrawalStatus = "pending") {
  const rows = await prisma.withdrawalRequest.findMany({
    where: { status },
    orderBy: { created_at: status === "pending" ? "asc" : "desc" },
    take: 100,
    select: { ...withdrawalSelect, user: { select: { user_id: true, username: true, pen_name: true, email: true } } },
  });
  return { withdrawals: rows.map((r) => ({ ...r, amount_thb: r.amount_thb.toNumber() })) };
}

/** PATCH /admin/withdrawals/:withdrawal_id — paid (โอนแล้ว) หรือ rejected (คืน coin) */
export async function adminProcessWithdrawal(
  withdrawal_id: string,
  admin_id: string,
  action: "paid" | "rejected",
  note?: string
) {
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.withdrawalRequest.findUnique({
      where: { withdrawal_id },
      select: { user_id: true, status: true, amount_coins: true },
    });
    if (!current) throw ApiError.notFound("Withdrawal not found");

    await lockWallets(tx, [current.user_id]);
    // อ่านซ้ำหลังได้ lock — แอดมินสองคนกดพร้อมกันต้องไม่คืน coin สองรอบ
    const res = await tx.withdrawalRequest.updateMany({
      where: { withdrawal_id, status: "pending" },
      data: { status: action, admin_note: note || null, processed_by: admin_id, processed_at: new Date() },
    });
    if (res.count === 0) throw ApiError.conflict("Withdrawal already processed");

    if (action === "rejected") {
      const balance = await getBalance(current.user_id, tx);
      await tx.walletTransaction.create({
        data: {
          user_id: current.user_id,
          type: "withdrawal_refund",
          amount: current.amount_coins,
          balance_after: balance + current.amount_coins,
          reference_id: withdrawal_id,
          created_at: ledgerTimestamp(),
        },
      });
    }

    await tx.notification.create({
      data: {
        user_id: current.user_id,
        type: "system",
        content:
          action === "paid"
            ? `คำขอถอน ${current.amount_coins} คอยน์ของคุณโอนเงินเรียบร้อยแล้ว`
            : `คำขอถอน ${current.amount_coins} คอยน์ของคุณถูกปฏิเสธ คอยน์ถูกคืนเข้ากระเป๋าแล้ว${note ? ` (${note})` : ""}`,
        link_url: "/wallet",
      },
    });

    return tx.withdrawalRequest.findUniqueOrThrow({ where: { withdrawal_id }, select: withdrawalSelect });
  }, WALLET_TX_OPTIONS);

  return serialize(updated);
}
