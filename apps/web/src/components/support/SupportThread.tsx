"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headset } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SupportStatusBadge } from "@/components/support/StatusBadge";
import { AttachmentPicker } from "@/components/support/AttachmentPicker";
import { formatApiError } from "@/lib/formatApiError";
import { SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL, type SupportStatus, type SupportTicketDetail } from "@/lib/support";
import { cn } from "@/lib/cn";

/** gap 3.2 — บทสนทนาของเรื่องแจ้งปัญหา (ผู้ใช้และทีมงานใช้หน้าเดียวกัน — ทีมงานมีตัวเลือกสถานะเพิ่ม) */
export function SupportThread({ ticket, isStaff }: { ticket: SupportTicketDetail; isStaff: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = ticket.status === "closed";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await call(`/api/v1/support/tickets/${ticket.ticket_id}/messages`, "POST", {
      body,
      ...(attachment ? { attachment_url: attachment } : {}),
    });
    setBody("");
    setAttachment(null);
  }

  async function setStatus(status: SupportStatus) {
    await call(`/api/v1/support/tickets/${ticket.ticket_id}/status`, "PATCH", { status });
  }

  async function call(url: string, method: string, payload: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        setError(formatApiError(await res.json().catch(() => null), "ทำรายการไม่สำเร็จ"));
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SupportStatusBadge status={ticket.status} />
          <h1 className="mt-2 text-h3 text-neutral-900">{ticket.subject}</h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            {SUPPORT_CATEGORY_LABEL[ticket.category]} · เปิดเมื่อ {new Date(ticket.created_at).toLocaleString("th-TH")}
            {isStaff && ` · โดย ${ticket.user.username}${ticket.user.email ? ` (${ticket.user.email})` : ""}`}
          </p>
        </div>
        {isStaff ? (
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            สถานะ
            <select
              value={ticket.status}
              disabled={busy}
              onChange={(e) => setStatus(e.target.value as SupportStatus)}
              className="min-h-[40px] rounded-lg border border-neutral-300 px-2 text-sm"
            >
              {(Object.keys(SUPPORT_STATUS_LABEL) as SupportStatus[]).map((s) => (
                <option key={s} value={s}>
                  {SUPPORT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          !closed && (
            <Button variant="outline" size="sm" onClick={() => setStatus("closed")} loading={busy}>
              ปัญหาหายแล้ว ปิดเรื่อง
            </Button>
          )
        )}
      </div>

      <ol className="mt-6 space-y-4">
        {ticket.messages.map((m) => {
          const mine = isStaff ? m.is_staff : !m.is_staff;
          return (
            <li key={m.message_id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[70%]",
                  mine ? "rounded-br-sm bg-primary-50 text-neutral-900" : "rounded-bl-sm border border-neutral-200 bg-white text-neutral-900"
                )}
              >
                <p className="mb-1 flex items-center gap-1 text-xs font-medium text-neutral-500">
                  {m.is_staff && <Headset className="h-3.5 w-3.5" />}
                  {m.is_staff ? (isStaff && m.author ? `ทีมงาน · ${m.author.username}` : "ทีมงาน BuddyBook") : m.author?.username ?? "ผู้แจ้ง"}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                {m.attachment_url && (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer" className="mt-2 block">
                    <Image src={m.attachment_url} alt="รูปที่แนบ" width={240} height={240} className="max-h-60 w-auto rounded-lg border border-neutral-200 object-contain" />
                  </a>
                )}
                <p className="mt-1.5 text-right text-[11px] text-neutral-400">{new Date(m.created_at).toLocaleString("th-TH")}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {closed && !isStaff ? (
        <p className="mt-6 rounded-lg bg-neutral-50 px-4 py-3 text-center text-sm text-neutral-500">
          เรื่องนี้ปิดแล้ว หากยังมีปัญหา กรุณาแจ้งเรื่องใหม่
        </p>
      ) : (
        <form onSubmit={send} className="mt-6 rounded-card border border-neutral-200 p-3 sm:p-4">
          <label htmlFor="support-reply" className="sr-only">
            ตอบกลับ
          </label>
          <textarea
            id="support-reply"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder={isStaff ? "ตอบกลับผู้ใช้..." : "พิมพ์ข้อความถึงทีมงาน..."}
            className="w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <AttachmentPicker value={attachment} onChange={setAttachment} />
            <Button type="submit" loading={busy} disabled={!body.trim()} className="max-sm:w-full">
              ส่งข้อความ
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
