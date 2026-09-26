"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { useDialogA11y } from "@/hooks/use-dialog-a11y";

export type ReportTargetType = "novel" | "chapter" | "comment" | "review" | "user";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "สแปม / โฆษณา" },
  { value: "harassment", label: "คุกคาม / ใช้ถ้อยคำรุนแรง" },
  { value: "inappropriate", label: "เนื้อหาไม่เหมาะสม" },
  { value: "copyright", label: "ละเมิดลิขสิทธิ์" },
  { value: "other", label: "อื่น ๆ" },
];

const TARGET_LABEL: Record<ReportTargetType, string> = {
  novel: "นิยายเรื่องนี้",
  chapter: "ตอนนี้",
  comment: "ความคิดเห็นนี้",
  review: "รีวิวนี้",
  user: "ผู้ใช้นี้",
};

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  isLoggedIn: boolean;
  /** icon = ปุ่มไอคอนเล็ก (ใช้ในคอมเมนต์/รีวิว), text = ปุ่มมีข้อความ */
  variant?: "icon" | "text";
  className?: string;
}

/** เพิ่มภายหลัง (รายงานเนื้อหา) — POST /api/v1/reports แอดมินตรวจที่ /admin/content-reports */
export function ReportButton({ targetType, targetId, isLoggedIn, variant = "text", className }: ReportButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function onClick() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={`รายงาน${TARGET_LABEL[targetType]}`}
        title="รายงาน"
        className={cn(
          "inline-flex items-center gap-1.5 text-neutral-400 transition-colors hover:text-red-500",
          variant === "text" && "text-sm",
          className
        )}
      >
        <Flag className={variant === "icon" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        {variant === "text" && "รายงาน"}
      </button>
      {open && <ReportDialog targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDialogA11y(dialogRef, onClose, !submitting);

  async function submit() {
    if (!reason) {
      setError("กรุณาเลือกเหตุผล");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
          details: details.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast("ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน");
        onClose();
        return;
      }
      if (res.status === 409) setError("คุณรายงานเนื้อหานี้ไปแล้ว");
      else if (res.status === 422) setError("ไม่สามารถรายงานเนื้อหาของตัวเองได้");
      else if (res.status === 429) setError("ส่งรายงานถี่เกินไป กรุณารอสักครู่");
      else setError("ส่งรายงานไม่สำเร็จ กรุณาลองใหม่");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-5 text-left text-neutral-800 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="report-dialog-title" className="text-base font-semibold">
            รายงาน{TARGET_LABEL[targetType]}
          </h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="mb-1 text-sm font-medium text-neutral-700">เหตุผล</legend>
          {REASONS.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="h-4 w-4 text-primary-500"
              />
              {r.label}
            </label>
          ))}
        </fieldset>

        <label className="mt-4 block text-sm font-medium text-neutral-700">
          รายละเอียดเพิ่มเติม (ไม่บังคับ)
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            rows={3}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-normal"
          />
        </label>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button size="sm" onClick={submit} loading={submitting}>
            ส่งรายงาน
          </Button>
        </div>
      </div>
    </div>
  );
}
