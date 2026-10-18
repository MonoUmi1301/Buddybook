"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, History, Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";

type TxType =
  | "topup"
  | "donation_sent"
  | "donation_received"
  | "chapter_purchase"
  | "chapter_sale"
  | "withdrawal"
  | "withdrawal_refund";

interface Tx {
  transaction_id: string;
  type: TxType;
  amount: string | number;
  balance_after: string | number;
  created_at: string;
}

/** amount ใน ledger เป็นบวกเสมอ — ทิศทาง (เข้า/ออก) มาจากประเภท */
const TYPE_INFO: Record<TxType, { label: string; incoming: boolean }> = {
  topup: { label: "เติม coin", incoming: true },
  donation_received: { label: "ได้รับของขวัญ", incoming: true },
  chapter_sale: { label: "รายได้จากตอนติดเหรียญ", incoming: true },
  withdrawal_refund: { label: "คืน coin จากการถอนที่ถูกปฏิเสธ", incoming: true },
  donation_sent: { label: "ส่งของขวัญ", incoming: false },
  chapter_purchase: { label: "ซื้อตอน", incoming: false },
  withdrawal: { label: "ถอนรายได้", incoming: false },
};

const dateFmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

/** ประวัติ coin เข้า-ออกล่าสุด 100 รายการ (ผลทดสอบ S4: เมนู "ประวัติการซื้อ" เดิมพาไปหน้าที่ไม่มีส่วนนี้)
 *  refreshKey เปลี่ยนเมื่อยอดเปลี่ยน (เติมเงิน/ถอน) ให้ดึงใหม่ */
export function TransactionHistory({ refreshKey }: { refreshKey?: number }) {
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/v1/wallet/transactions", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { transactions: Tx[] };
      setTxs(json.transactions);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section id="history" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <History className="h-5 w-5 text-primary-500" />
          ประวัติ coin
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
        >
          <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
          รีเฟรช
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-card border border-neutral-200">
        {loading && txs === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : error && txs === null ? (
          <div className="py-10 text-center text-sm text-neutral-600">
            โหลดประวัติไม่ได้{" "}
            <button type="button" onClick={() => void load()} className="font-medium text-primary-500 hover:underline">
              ลองอีกครั้ง
            </button>
          </div>
        ) : !txs || txs.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">ยังไม่มีรายการ เติม coin ครั้งแรกแล้วรายการจะขึ้นที่นี่</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {txs.map((tx) => {
              const info = TYPE_INFO[tx.type] ?? { label: tx.type, incoming: true };
              const amount = Number(tx.amount);
              return (
                <li key={tx.transaction_id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      info.incoming ? "bg-green-50 text-green-600" : "bg-neutral-100 text-neutral-500"
                    )}
                    aria-hidden
                  >
                    {info.incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{info.label}</p>
                    <p className="text-xs text-neutral-500">{dateFmt.format(new Date(tx.created_at))}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-sm font-bold tabular-nums", info.incoming ? "text-green-600" : "text-neutral-900")}>
                      {info.incoming ? "+" : "−"}
                      {amount.toLocaleString()}
                    </p>
                    <p className="text-xs tabular-nums text-neutral-400">คงเหลือ {Number(tx.balance_after).toLocaleString()}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
