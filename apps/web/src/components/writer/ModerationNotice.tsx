"use client";

import { useEffect, useState } from "react";
import { Clock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { MODERATION_STATUS_LABEL, canAppeal, type ModerationCase } from "@/lib/moderation";
import { THAI_TIME_ZONE } from "@/lib/format";
import { ModalBackdrop } from "@/components/ui/modal-backdrop";

const MIN_APPEAL = 20;
const MAX_APPEAL = 5000;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: THAI_TIME_ZONE });
}

interface ModerationNoticeProps {
  novelId: string;
  novelTitle: string;
  moderationCase: ModerationCase;
  /** เปิดฟอร์มอุทธรณ์ทันที — มาจากลิงก์ในแจ้งเตือน/อีเมล (?appeal=1) */
  openAppealOnMount?: boolean;
  onAppealed: (updated: ModerationCase) => void;
}

/** post-moderation — แถบแจ้งนักเขียนว่านิยายถูกระงับ พร้อมเหตุผล สถานะอุทธรณ์ และฟอร์มยื่นอุทธรณ์ */
export function ModerationNotice({ novelId, novelTitle, moderationCase: c, openAppealOnMount, onAppealed }: ModerationNoticeProps) {
  const appealable = canAppeal(c);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (openAppealOnMount && appealable) setOpen(true);
  }, [openAppealOnMount, appealable]);

  const trimmed = message.trim();
  const tooShort = trimmed.length < MIN_APPEAL;

  async function submit() {
    if (tooShort) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/novels/${novelId}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "ส่งคำอุทธรณ์ไม่สำเร็จ");
        return;
      }
      onAppealed(json.moderation_case as ModerationCase);
      setOpen(false);
      setMessage("");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section
        aria-labelledby="moderation-notice-title"
        className="mb-5 rounded-card border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 id="moderation-notice-title" className="font-semibold">
              นิยายเรื่องนี้ถูกระงับการเผยแพร่ · {MODERATION_STATUS_LABEL[c.status]}
            </h2>
            <p className="mt-0.5 text-xs opacity-80">ระงับเมื่อ {formatDate(c.created_at)} — ผู้อ่านจะไม่เห็นนิยายเรื่องนี้จนกว่าทีมงานจะคืนสถานะ</p>

            <p className="mt-3 text-xs font-semibold">เหตุผลจากทีมงาน</p>
            <p className="mt-1 whitespace-pre-line break-words rounded-lg bg-white/70 px-3 py-2 text-sm text-neutral-800 dark:bg-black/20 dark:text-neutral-100">
              {c.reason}
            </p>

            {c.status === "upheld" && c.resolution_note && (
              <>
                <p className="mt-3 text-xs font-semibold">ผลการพิจารณาคำอุทธรณ์ครั้งล่าสุด</p>
                <p className="mt-1 whitespace-pre-line break-words rounded-lg bg-white/70 px-3 py-2 text-sm text-neutral-800 dark:bg-black/20 dark:text-neutral-100">
                  {c.resolution_note}
                </p>
              </>
            )}

            {c.status === "appeal_pending" ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 shrink-0" />
                ส่งคำอุทธรณ์แล้ว{c.appealed_at ? `เมื่อ ${formatDate(c.appealed_at)}` : ""} ทีมงานจะตรวจซ้ำและแจ้งผลทางแจ้งเตือนและอีเมล
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm">
                  แก้ไขเนื้อหาตามเหตุผลด้านบน (ยังแก้ไขนิยายและตอนได้ตามปกติ) แล้วกดยื่นอุทธรณ์เพื่อให้ทีมงานตรวจซ้ำ
                </p>
                <Button size="sm" className="mt-3 !bg-red-600 hover:!bg-red-700" onClick={() => setOpen(true)}>
                  ยื่นอุทธรณ์ / ขอให้ตรวจซ้ำ
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {open && (
        <ModalBackdrop className="z-50 items-center bg-black/40 px-4" onDismiss={() => !submitting && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="appeal-dialog-title"
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-xl"
          >
            <h2 id="appeal-dialog-title" className="text-h3 text-neutral-900">
              ยื่นอุทธรณ์
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              &quot;{novelTitle}&quot; — อธิบายว่าทำไมนิยายเรื่องนี้ไม่ได้ละเมิดแนวทาง หรือแก้ไขอะไรไปแล้วบ้าง ทีมงานจะตรวจซ้ำและแจ้งผล
            </p>
            <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              <span className="font-semibold">เหตุผลที่ถูกระงับ:</span> {c.reason}
            </p>
            <div className="mt-4">
              <Textarea
                label="คำชี้แจงของคุณ"
                name="appeal_message"
                rows={6}
                value={message}
                maxLength={MAX_APPEAL}
                onChange={(e) => setMessage(e.target.value)}
                hint="เช่น ตัดฉากในตอนที่ 3 ออกแล้ว และเปลี่ยนเรตเป็น 18+"
                autoFocus
              />
              <p className={`mt-1 text-right text-xs ${tooShort ? "text-neutral-400" : "text-neutral-500"}`}>
                {tooShort ? `อย่างน้อย ${MIN_APPEAL} ตัวอักษร (${trimmed.length}/${MIN_APPEAL})` : `${trimmed.length}/${MAX_APPEAL}`}
              </p>
            </div>
            {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                ยกเลิก
              </Button>
              <Button onClick={submit} loading={submitting} disabled={tooShort}>
                ส่งคำอุทธรณ์
              </Button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </>
  );
}
