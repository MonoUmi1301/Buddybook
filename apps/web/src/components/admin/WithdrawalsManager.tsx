"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/Toaster";
import { formatThaiDate } from "@/lib/format";
import { WITHDRAWAL_STATUS_LABEL, type WithdrawalRow } from "@/components/wallet/WithdrawalSection";

export interface AdminWithdrawalRow extends WithdrawalRow {
  user: { user_id: string; username: string; pen_name: string | null; email: string };
}

type Status = WithdrawalRow["status"];

const TABS: Status[] = ["pending", "paid", "rejected"];

/** เพิ่มภายหลัง (ถอนรายได้นักเขียน) — แอดมินโอนเงินจริงนอกระบบแล้วกด "โอนแล้ว" หรือปฏิเสธ (คืน coin) */
export function WithdrawalsManager({ initial }: { initial: AdminWithdrawalRow[] }) {
  const [status, setStatus] = useState<Status>("pending");
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function switchTab(next: Status) {
    setStatus(next);
    setLoading(true);
    const res = await fetch(`/api/v1/admin/withdrawals?status=${next}`, { cache: "no-store" });
    setItems(res.ok ? ((await res.json()) as { withdrawals: AdminWithdrawalRow[] }).withdrawals : []);
    setLoading(false);
  }

  async function process(row: AdminWithdrawalRow, action: "paid" | "rejected") {
    let note: string | undefined;
    if (action === "rejected") {
      const input = window.prompt("เหตุผลที่ปฏิเสธ (ผู้ใช้จะเห็นข้อความนี้)");
      if (input === null) return;
      note = input.trim() || undefined;
    } else if (!window.confirm(`ยืนยันว่าโอน ${row.amount_thb.toLocaleString("th-TH")} บาท ให้ ${row.account_name} แล้ว?`)) {
      return;
    }
    setBusyId(row.withdrawal_id);
    const res = await fetch(`/api/v1/admin/withdrawals/${row.withdrawal_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    if (res.ok) {
      setItems((xs) => xs.filter((x) => x.withdrawal_id !== row.withdrawal_id));
      toast(action === "paid" ? "บันทึกว่าโอนแล้ว" : "ปฏิเสธและคืนคอยน์แล้ว");
    } else {
      toast("ทำรายการไม่สำเร็จ");
    }
    setBusyId(null);
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900">คำขอถอนรายได้</h2>
      <p className="mb-4 text-xs text-neutral-500">คอยน์ถูกหักจากกระเป๋านักเขียนแล้วตั้งแต่ขอถอน — ปฏิเสธจะคืนคอยน์ให้อัตโนมัติ</p>

      <div className="mb-4 flex gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={status === t}
            onClick={() => switchTab(t)}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm",
              status === t ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {WITHDRAWAL_STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-card border border-dashed border-neutral-300 px-6 py-12 text-center text-sm text-neutral-500">
          ไม่มีรายการ
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.withdrawal_id} className="rounded-card border border-neutral-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-base font-semibold text-neutral-900">
                  {row.amount_thb.toLocaleString("th-TH")} บาท
                  <span className="ml-2 text-sm font-normal text-neutral-500">({row.amount_coins.toLocaleString()} คอยน์)</span>
                </p>
                <span className="text-xs text-neutral-400">{formatThaiDate(row.created_at)}</span>
              </div>
              <dl className="mt-2 grid gap-1 text-neutral-700 sm:grid-cols-2">
                <div>
                  <dt className="inline text-neutral-500">ผู้ขอ: </dt>
                  <dd className="inline">
                    {row.user.pen_name || row.user.username} ({row.user.email})
                  </dd>
                </div>
                <div>
                  <dt className="inline text-neutral-500">ช่องทาง: </dt>
                  <dd className="inline">{row.payout_method === "promptpay" ? "PromptPay" : `ธนาคาร ${row.bank_name}`}</dd>
                </div>
                <div>
                  <dt className="inline text-neutral-500">ชื่อบัญชี: </dt>
                  <dd className="inline">{row.account_name}</dd>
                </div>
                <div>
                  <dt className="inline text-neutral-500">เลขที่: </dt>
                  <dd className="inline font-mono">{row.account_number}</dd>
                </div>
                {row.admin_note && (
                  <div className="sm:col-span-2">
                    <dt className="inline text-neutral-500">หมายเหตุ: </dt>
                    <dd className="inline">{row.admin_note}</dd>
                  </div>
                )}
              </dl>
              {row.status === "pending" && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.withdrawal_id}
                    onClick={() => process(row, "rejected")}
                    className="min-h-[44px] rounded-pill border border-neutral-300 px-5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    ปฏิเสธ
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.withdrawal_id}
                    onClick={() => process(row, "paid")}
                    className="min-h-[44px] rounded-pill bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    โอนแล้ว
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
