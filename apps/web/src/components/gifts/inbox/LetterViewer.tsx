"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { GiftImage } from "@/components/gifts/GiftImage";
import { LetterCard } from "@/components/gifts/LetterCard";
import { toast } from "@/components/ui/Toaster";
import { useDialogA11y } from "@/hooks/use-dialog-a11y";
import { formatThaiDate } from "@/lib/format";
import {
  REPORT_REASON_MAX,
  THANK_MESSAGE_MAX,
  countCardChars,
  formatCoins,
  giftLabel,
  senderLabel,
  stripEmoji,
  thankInboxItem,
  updateInboxItem,
  type InboxItem,
} from "@/lib/gifts";
import { cn } from "@/lib/cn";

interface LetterViewerProps {
  item: InboxItem;
  authorName: string;
  /** อัตราค่าธรรมเนียมปัจจุบัน (ป้าย %) — ตัวเลขจริงมาจาก fee_amount ของรายการ */
  feePercent: number | null;
  onChange: (item: InboxItem) => void;
  onClose: () => void;
}

const QUICK_THANKS = ["ขอบคุณมากนะ ได้กำลังใจเต็มเปี่ยมเลย", "ดีใจมากที่ชอบเรื่องนี้", "จะตั้งใจเขียนตอนต่อไปให้ดีที่สุด"];

/** เพิ่มภายหลัง (Gift donations) — เปิดอ่านการ์ดในกล่องจดหมายนักเขียน (การ์ดลอยขึ้นจากซอง)
 *  ตอบขอบคุณได้ครั้งเดียว (แจ้งเตือนกลับไปหาผู้ส่ง) ซ่อน/เลิกซ่อน และรายงานข้อความไม่เหมาะสม */
export function LetterViewer({ item, authorName, feePercent, onChange, onClose }: LetterViewerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [thankText, setThankText] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [busy, setBusy] = useState<"thank" | "hide" | "report" | null>(null);
  const [error, setError] = useState<string | null>(null);
  useDialogA11y(dialogRef, onClose, busy === null);

  const thankCount = countCardChars(thankText);

  async function run(kind: "thank" | "hide" | "report", action: () => Promise<InboxItem>, done: string) {
    setBusy(kind);
    setError(null);
    try {
      onChange(await action());
      toast(done);
      if (kind === "report") setReporting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  const where = [item.novel?.title, item.chapter ? `ตอนที่ ${item.chapter.chapter_number}` : null].filter(Boolean).join(" · ");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 md:items-center md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && busy === null) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="letter-viewer-title"
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-gift-surface text-gift-ink shadow-2xl outline-none md:max-h-[min(90vh,820px)] md:max-w-xl md:rounded-3xl"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-gift-edge px-4 pb-3 pt-4 md:px-6">
          <div className="min-w-0 flex-1">
            <h2 id="letter-viewer-title" className="truncate text-lg font-bold">
              จาก {senderLabel(item)}
            </h2>
            <p className="truncate text-xs text-gift-muted">
              {formatThaiDate(item.created_at)}
              {where && ` · ${where}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            aria-label="ปิด"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gift-muted hover:bg-gift-edge/50 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <div className="flex items-center gap-3 rounded-2xl bg-gift-paper p-3">
            <div className="h-14 w-14 shrink-0">
              {item.gift ? (
                <GiftImage slug={item.gift.slug} alt="" sizes="56px" eager />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gift-surface text-sm font-bold text-gift-bear">
                  {item.amount.toLocaleString("th-TH")}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{item.gift ? giftLabel(item) : "Custom coins"}</p>
              <p className="text-sm text-gift-muted">
                ได้รับสุทธิ <span className="font-semibold text-gift-ink">{formatCoins(item.net_amount)}</span>
              </p>
            </div>
            <span className="shrink-0 rounded-pill border border-gift-edge px-2.5 py-1 text-[11px] text-gift-muted">
              {item.is_public ? "การ์ดสาธารณะ" : "เห็นเฉพาะคุณ"}
            </span>
          </div>

          {/* แจกแจงยอด: ของขวัญ - ค่าธรรมเนียมแพลตฟอร์ม = ที่ได้รับ */}
          <dl className="mt-3 space-y-1 rounded-2xl border border-gift-edge px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gift-muted">ยอดของขวัญ</dt>
              <dd className="tabular-nums">{formatCoins(item.amount)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gift-muted">
                ค่าธรรมเนียมแพลตฟอร์ม{item.fee_amount > 0 && feePercent !== null ? ` ${feePercent}%` : ""}
              </dt>
              <dd className="tabular-nums">{item.fee_amount > 0 ? `-${formatCoins(item.fee_amount)}` : "ไม่หัก"}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-gift-edge pt-1 font-semibold">
              <dt>ได้รับสุทธิ</dt>
              <dd className="tabular-nums">{formatCoins(item.net_amount)}</dd>
            </div>
          </dl>

          <div className="gift-letter-rise mt-5">
            <LetterCard
              template={item.card_template ?? "stamp"}
              recipientName={authorName}
              message={item.message ?? ""}
              signature={senderLabel(item)}
              placeholder="ส่งของขวัญมาโดยไม่มีข้อความ"
            />
          </div>

          {/* ตอบขอบคุณ */}
          <section className="mt-6" aria-labelledby="thank-heading">
            <h3 id="thank-heading" className="text-sm font-semibold">
              ขอบคุณผู้ส่ง
            </h3>
            {item.thanked_at ? (
              <p className="mt-2 rounded-xl bg-gift-paper px-3 py-2.5 text-sm">
                <span className="text-gift-muted">คุณตอบว่า: </span>
                {item.thank_message}
              </p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {QUICK_THANKS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setThankText(t)}
                      className="min-h-[36px] rounded-pill border border-gift-edge px-3 text-xs hover:border-gift-bear"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="thank-text" className="sr-only">
                      ข้อความขอบคุณ
                    </label>
                    <textarea
                      id="thank-text"
                      value={thankText}
                      onChange={(e) => setThankText(stripEmoji(e.target.value))}
                      rows={2}
                      placeholder="พิมพ์คำขอบคุณสั้น ๆ"
                      className="w-full resize-none rounded-xl border border-gift-edge bg-gift-surface px-3 py-2 text-base focus:border-gift-bear focus:outline-none md:text-sm"
                    />
                    <p className={cn("text-right text-[11px] tabular-nums", thankCount > THANK_MESSAGE_MAX ? "text-red-600 dark:text-red-400" : "text-gift-muted")}>
                      {thankCount}/{THANK_MESSAGE_MAX}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== null || thankCount === 0 || thankCount > THANK_MESSAGE_MAX}
                    onClick={() => run("thank", () => thankInboxItem(item.donation_id, thankText.trim()), "ส่งคำขอบคุณแล้ว")}
                    className="mb-5 inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-pill bg-gift-bear px-5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy === "thank" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    ขอบคุณ
                  </button>
                </div>
                {item.is_anonymous && <p className="text-xs text-gift-muted">ผู้ส่งเลือกไม่ระบุตัวตน ระบบจะส่งคำขอบคุณให้โดยไม่เปิดเผยชื่อ</p>}
              </>
            )}
          </section>

          {/* รายงาน */}
          {reporting && !item.reported_at && (
            <section className="mt-5 rounded-2xl border border-gift-edge p-3" aria-labelledby="report-heading">
              <h3 id="report-heading" className="text-sm font-semibold">
                รายงานการ์ดนี้
              </h3>
              <p className="mt-0.5 text-xs text-gift-muted">ทีมงานจะตรวจสอบข้อความ การ์ดที่ถูกรายงานจะไม่แสดงต่อสาธารณะระหว่างตรวจสอบ</p>
              <label htmlFor="report-reason" className="sr-only">
                เหตุผล
              </label>
              <textarea
                id="report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(stripEmoji(e.target.value).slice(0, REPORT_REASON_MAX * 2))}
                rows={2}
                placeholder="เหตุผล (ไม่บังคับ)"
                className="mt-2 w-full resize-none rounded-xl border border-gift-edge bg-gift-surface px-3 py-2 text-base focus:border-gift-bear focus:outline-none md:text-sm"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setReporting(false)} className="min-h-[44px] rounded-pill px-4 text-sm">
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={busy !== null || countCardChars(reportReason) > REPORT_REASON_MAX}
                  onClick={() =>
                    run("report", () => updateInboxItem(item.donation_id, { report_reason: reportReason.trim() }), "ส่งรายงานแล้ว")
                  }
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-pill bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === "report" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  ยืนยันรายงาน
                </button>
              </div>
            </section>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="gift-safe-bottom flex shrink-0 flex-wrap items-center gap-2 border-t border-gift-edge px-4 pt-3 md:px-6 md:pb-4">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              run(
                "hide",
                () => updateInboxItem(item.donation_id, { hidden: !item.hidden_at }),
                item.hidden_at ? "แสดงการ์ดนี้อีกครั้งแล้ว" : "ซ่อนการ์ดแล้ว"
              )
            }
            className="inline-flex min-h-[44px] items-center gap-2 rounded-pill border border-gift-edge px-4 text-sm hover:border-gift-bear disabled:opacity-50"
          >
            {busy === "hide" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {item.hidden_at ? "เลิกซ่อน" : "ซ่อน"}
          </button>
          {item.reported_at ? (
            <span className="text-sm text-gift-muted">รายงานแล้ว</span>
          ) : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setReporting(true)}
              className="min-h-[44px] rounded-pill px-4 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
            >
              รายงาน
            </button>
          )}
          {item.sender && !item.is_anonymous && (
            <Link href={`/profile/${item.sender.user_id}`} className="ml-auto inline-flex min-h-[44px] items-center px-2 text-sm text-gift-bear hover:underline">
              ดูโปรไฟล์ผู้ส่ง
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
