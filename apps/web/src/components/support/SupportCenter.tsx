"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SupportStatusBadge } from "@/components/support/StatusBadge";
import { AttachmentPicker } from "@/components/support/AttachmentPicker";
import { formatApiError } from "@/lib/formatApiError";
import { SUPPORT_CATEGORY_LABEL, type SupportCategory, type SupportTicketSummary } from "@/lib/support";
import { cn } from "@/lib/cn";

/**
 * gap 3.2 — ศูนย์ช่วยเหลือ: แจ้งปัญหาใหม่ + รายการเรื่องที่เคยแจ้ง
 * desktop: ฟอร์มซ้าย / รายการขวา (2 คอลัมน์) — iPad/มือถือ: เรียงลงมาเป็นคอลัมน์เดียว
 */
export function SupportCenter({ tickets }: { tickets: SupportTicketSummary[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<SupportCategory>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, body, ...(attachment ? { attachment_url: attachment } : {}) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "ส่งเรื่องไม่สำเร็จ"));
        return;
      }
      router.push(`/support/${json.ticket_id}`);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <form onSubmit={submit} className="rounded-card border border-neutral-200 p-4 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <MessageSquarePlus className="h-5 w-5 text-primary-500" /> แจ้งปัญหาใหม่
        </h2>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-neutral-800">เรื่องเกี่ยวกับ</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SUPPORT_CATEGORY_LABEL) as SupportCategory[]).map((c) => (
              <label
                key={c}
                className={cn(
                  "inline-flex min-h-[40px] cursor-pointer items-center rounded-pill border px-3.5 text-sm transition-colors",
                  category === c ? "border-primary-400 bg-primary-50 text-primary-800" : "border-neutral-200 text-neutral-700 hover:border-neutral-300"
                )}
              >
                <input type="radio" name="category" value={c} checked={category === c} onChange={() => setCategory(c)} className="sr-only" />
                {SUPPORT_CATEGORY_LABEL[c]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <Input label="หัวข้อ" placeholder="เช่น เติมเงินแล้วเหรียญไม่เข้า" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} required />
        </div>

        <div className="mt-4">
          <label htmlFor="support-body" className="mb-1.5 block text-sm font-medium text-neutral-800">
            รายละเอียด
          </label>
          <textarea
            id="support-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={5000}
            required
            placeholder="เล่าสิ่งที่เกิดขึ้น ทำอะไรอยู่ตอนเจอปัญหา และเกิดเมื่อไหร่ — ยิ่งละเอียดยิ่งช่วยได้เร็ว"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <p className="mt-1 text-right text-xs text-neutral-400">{body.length}/5000</p>
        </div>

        <div className="mt-2">
          <AttachmentPicker value={attachment} onChange={setAttachment} />
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end">
          <Button type="submit" loading={submitting} className="max-sm:w-full">
            ส่งเรื่องถึงทีมงาน
          </Button>
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">เรื่องที่เคยแจ้ง</h2>
        {tickets.length === 0 ? (
          <p className="rounded-card border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-400">ยังไม่เคยแจ้งปัญหา</p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-card border border-neutral-200">
            {tickets.map((t) => (
              <li key={t.ticket_id}>
                <Link href={`/support/${t.ticket_id}`} className="flex items-center gap-3 p-3.5 hover:bg-neutral-50 sm:p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SupportStatusBadge status={t.status} />
                      {t.awaiting_user && (
                        <span className="rounded-pill bg-primary-500 px-2 py-0.5 text-[11px] font-medium text-white">มีคำตอบใหม่</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm font-medium text-neutral-900">{t.subject}</p>
                    <p className="text-xs text-neutral-500">
                      {SUPPORT_CATEGORY_LABEL[t.category]} · {t.message_count} ข้อความ · อัปเดต{" "}
                      {new Date(t.updated_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
