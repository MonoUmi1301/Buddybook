"use client";

import { useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { formatThaiDate } from "@/lib/format";
import { formatApiError } from "@/lib/formatApiError";

export interface WithdrawalRow {
  withdrawal_id: string;
  amount_coins: number;
  amount_thb: number;
  payout_method: "promptpay" | "bank";
  account_name: string;
  account_number: string;
  bank_name: string | null;
  status: "pending" | "paid" | "rejected";
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
}

interface WithdrawalSummary {
  withdrawals: WithdrawalRow[];
  balance: number;
  total_earned: number;
  withdrawable_coins: number;
  min_withdrawal_coins: number;
  coin_to_thb_rate: number;
}

export const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalRow["status"], string> = {
  pending: "รอดำเนินการ",
  paid: "โอนแล้ว",
  rejected: "ถูกปฏิเสธ",
};

const statusClass: Record<WithdrawalRow["status"], string> = {
  pending: "bg-amber-500/10 text-amber-700",
  paid: "bg-emerald-500/10 text-emerald-700",
  rejected: "bg-red-500/10 text-red-600",
};

/** เพิ่มภายหลัง (ถอนรายได้นักเขียน) — แสดงเฉพาะผู้ที่มีรายได้ (ได้ของขวัญ/ขายตอน) หรือเคยขอถอน
 *  ถอนได้เฉพาะรายได้ ไม่รวม coin ที่เติมเอง (ดู apps/api/src/modules/wallet/withdrawals.service.ts) */
export function WithdrawalSection({ onBalanceChange }: { onBalanceChange: (balance: number) => void }) {
  const [data, setData] = useState<WithdrawalSummary | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"promptpay" | "bank">("promptpay");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/v1/wallet/withdrawals", { cache: "no-store" });
    if (res.ok) setData((await res.json()) as WithdrawalSummary);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  if (!data || (data.total_earned <= 0 && data.withdrawals.length === 0)) return null;

  const hasPending = data.withdrawals.some((w) => w.status === "pending");
  const canWithdraw = !hasPending && data.withdrawable_coins >= data.min_withdrawal_coins;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const coins = Number(amount);
    if (!Number.isInteger(coins) || coins < data.min_withdrawal_coins || coins > data.withdrawable_coins) {
      setError(`ระบุจำนวน ${data.min_withdrawal_coins.toLocaleString()}-${data.withdrawable_coins.toLocaleString()} คอยน์`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/wallet/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_coins: coins,
          payout_method: method,
          account_name: accountName.trim(),
          account_number: accountNumber.trim(),
          bank_name: method === "bank" ? bankName.trim() : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "ขอถอนไม่สำเร็จ"));
        return;
      }
      toast("ส่งคำขอถอนแล้ว ทีมงานจะโอนภายใน 3-5 วันทำการ");
      setAmount("");
      await load();
      onBalanceChange(data.balance - coins);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 border-b border-neutral-200 pb-4">
        <Banknote className="h-8 w-8 text-emerald-500" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">ถอนรายได้</h2>
          <p className="text-sm text-neutral-500">
            ถอนได้ {data.withdrawable_coins.toLocaleString()} คอยน์ (≈{" "}
            {(data.withdrawable_coins * data.coin_to_thb_rate).toLocaleString("th-TH")} บาท) · ขั้นต่ำ{" "}
            {data.min_withdrawal_coins.toLocaleString()} คอยน์ · ถอนได้เฉพาะรายได้จากของขวัญและตอนติดเหรียญ
          </p>
        </div>
      </div>

      {hasPending ? (
        <p className="mt-4 rounded-card bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          มีคำขอถอนที่รอดำเนินการอยู่ ขอใหม่ได้หลังรายการนี้เสร็จสิ้น
        </p>
      ) : !canWithdraw ? (
        <p className="mt-4 text-sm text-neutral-500">ยอดที่ถอนได้ยังไม่ถึงขั้นต่ำ</p>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-neutral-700">
            จำนวนคอยน์
            <input
              type="number"
              inputMode="numeric"
              min={data.min_withdrawal_coins}
              max={data.withdrawable_coins}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm text-neutral-700">
            ช่องทางรับเงิน
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "promptpay" | "bank")}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            >
              <option value="promptpay">PromptPay</option>
              <option value="bank">บัญชีธนาคาร</option>
            </select>
          </label>
          <label className="text-sm text-neutral-700">
            ชื่อบัญชี
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              maxLength={100}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm text-neutral-700">
            {method === "promptpay" ? "เบอร์มือถือ / เลขบัตรประชาชน" : "เลขที่บัญชี"}
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              inputMode="numeric"
              maxLength={20}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              required
            />
          </label>
          {method === "bank" && (
            <label className="text-sm text-neutral-700 sm:col-span-2">
              ธนาคาร
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                maxLength={100}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
                required
              />
            </label>
          )}
          {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" loading={submitting}>
              ขอถอนรายได้
            </Button>
          </div>
        </form>
      )}

      {data.withdrawals.length > 0 && (
        <ul className="mt-6 divide-y divide-neutral-100 rounded-card border border-neutral-200">
          {data.withdrawals.map((w) => (
            <li key={w.withdrawal_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-neutral-900">
                  {w.amount_coins.toLocaleString()} คอยน์ · {w.amount_thb.toLocaleString("th-TH")} บาท
                </p>
                <p className="text-xs text-neutral-500">
                  {formatThaiDate(w.created_at)} · {w.payout_method === "promptpay" ? "PromptPay" : w.bank_name} ···
                  {w.account_number.slice(-4)}
                  {w.admin_note && ` · ${w.admin_note}`}
                </p>
              </div>
              <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", statusClass[w.status])}>
                {WITHDRAWAL_STATUS_LABEL[w.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
