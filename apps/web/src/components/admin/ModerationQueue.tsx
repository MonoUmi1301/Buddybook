"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Ban, CheckCircle2, ExternalLink, Flag, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { formatThaiDate } from "@/lib/format";
import { MODERATION_STATUS_LABEL, type ModerationCase } from "@/lib/moderation";
import { ModalBackdrop } from "@/components/ui/modal-backdrop";
import { handleAsync } from "@/lib/handleAsync";

export type ModerationTab = "unreviewed" | "reported" | "appeals" | "suspended";

export interface ModerationQueueNovel {
  novel_id: string;
  title: string;
  synopsis: string | null;
  cover_image_url: string | null;
  legal_status: string;
  content_rating: "all_ages" | "teen" | "mature";
  visibility: "published" | "private" | "suspended";
  created_at: string;
  updated_at: string | null;
  moderation_reviewed_at: string | null;
  author: { user_id: string; username: string; pen_name: string | null };
  published_chapter_count: number;
  open_report_count: number;
  moderation_case: ModerationCase | null;
}

export interface ModerationQueuePage {
  tab: ModerationTab;
  novels: ModerationQueueNovel[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<ModerationTab, number>;
}

const TABS: { value: ModerationTab; label: string; hint: string }[] = [
  { value: "unreviewed", label: "ยังไม่ตรวจ", hint: "นิยายที่เผยแพร่อยู่และยังไม่ได้สุ่มตรวจ หรือแก้ไขหลังตรวจครั้งล่าสุด (ใหม่สุดก่อน)" },
  { value: "reported", label: "ถูกรายงาน", hint: "นิยายที่ผู้อ่านรายงานเข้ามาและยังไม่ได้จัดการ (รายงานมากสุดก่อน)" },
  { value: "appeals", label: "อุทธรณ์รอพิจารณา", hint: "นักเขียนยื่นอุทธรณ์ขอให้ตรวจซ้ำ (ยื่นก่อนได้ก่อน)" },
  { value: "suspended", label: "ถูกระงับ", hint: "นิยายที่ระงับอยู่ทั้งหมด ยกเลิกการระงับได้จากที่นี่" },
];

const legalStatusLabel: Record<string, string> = { original: "ต้นฉบับ", fan_fiction: "แฟนฟิค", translation: "แปล" };
const ratingLabel: Record<ModerationQueueNovel["content_rating"], string> = { all_ages: "ทุกวัย", teen: "13+", mature: "18+" };

type Dialog =
  | { kind: "suspend"; novel: ModerationQueueNovel }
  | { kind: "uphold"; novel: ModerationQueueNovel }
  | { kind: "reinstate"; novel: ModerationQueueNovel };

const MIN_REASON = 10;

/** post-moderation — คิวตรวจนิยายที่เผยแพร่แล้ว แทนคิวอนุมัติ (approve/reject) เดิม
 *  GET /admin/novels/moderation · PATCH /admin/novels/:id/{suspend,reviewed,moderation} */
export function ModerationQueue({ initial }: { initial: ModerationQueuePage }) {
  const [tab, setTab] = useState<ModerationTab>(initial.tab);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [text, setText] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  async function load(nextTab: ModerationTab, page = 1) {
    setLoading(true);
    const params = new URLSearchParams({ tab: nextTab, page: String(page) });
    const res = await fetch(`/api/v1/admin/novels/moderation?${params}`, { cache: "no-store" });
    if (res.ok) {
      const next = (await res.json()) as ModerationQueuePage;
      setData((prev) => (page > 1 ? { ...next, novels: [...prev.novels, ...next.novels] } : next));
    } else {
      toast("โหลดคิวตรวจไม่สำเร็จ");
    }
    setLoading(false);
  }

  function switchTab(next: ModerationTab) {
    setTab(next);
    window.history.replaceState(null, "", `/admin/novels?tab=${next}`);
    void load(next);
  }

  /** เอานิยายออกจากรายการปัจจุบัน แล้วดึงตัวเลขบนแท็บใหม่ */
  function removeFromList(novel_id: string) {
    setData((d) => ({ ...d, novels: d.novels.filter((n) => n.novel_id !== novel_id), total: Math.max(0, d.total - 1) }));
    void fetch(`/api/v1/admin/novels/moderation?tab=${tab}&page=1`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: ModerationQueuePage | null) => p && setData((d) => ({ ...d, counts: p.counts })));
  }

  async function markReviewed(n: ModerationQueueNovel) {
    setBusyId(n.novel_id);
    const res = await fetch(`/api/v1/admin/novels/${n.novel_id}/reviewed`, { method: "PATCH" });
    if (res.ok) {
      removeFromList(n.novel_id);
      toast("บันทึกว่าตรวจแล้ว");
    } else {
      toast("ทำรายการไม่สำเร็จ");
    }
    setBusyId(null);
  }

  function openDialog(d: Dialog) {
    setDialog(d);
    setText("");
    setDialogError(null);
  }

  async function submitDialog() {
    if (!dialog) return;
    const { kind, novel } = dialog;
    const value = text.trim();
    if ((kind === "suspend" || kind === "uphold") && value.length < MIN_REASON) {
      setDialogError(`ระบุเหตุผลอย่างน้อย ${MIN_REASON} ตัวอักษร`);
      return;
    }
    setBusyId(novel.novel_id);
    setDialogError(null);
    const res =
      kind === "suspend"
        ? await fetch(`/api/v1/admin/novels/${novel.novel_id}/suspend`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: value }),
          })
        : await fetch(`/api/v1/admin/novels/${novel.novel_id}/moderation`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: kind, ...(value ? { note: value } : {}) }),
          });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setDialogError(json.error ?? "ทำรายการไม่สำเร็จ");
      return;
    }
    setDialog(null);
    void load(tab);
    const emailNote = json.notified?.email ? " (ส่งอีเมลแล้ว)" : " (แจ้งในเว็บแล้ว ส่งอีเมลไม่ได้)";
    toast(
      (kind === "suspend" ? "ระงับนิยายแล้ว" : kind === "reinstate" ? "คืนสถานะนิยายแล้ว" : "ยืนยันการระงับแล้ว") + emailNote
    );
  }

  const activeTab = TABS.find((t) => t.value === tab)!;
  const hasMore = data.novels.length < data.total;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => switchTab(t.value)}
            className={cn(
              "inline-flex min-h-[36px] items-center gap-1.5 rounded-pill px-4 py-1.5 text-sm",
              tab === t.value ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {t.label}
            {data.counts[t.value] > 0 && (
              <span
                className={cn(
                  "rounded-pill px-1.5 text-[11px] font-semibold tabular-nums",
                  tab === t.value ? "bg-white/20 text-white" : t.value === "appeals" ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-600"
                )}
              >
                {data.counts[t.value].toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-neutral-500">{activeTab.hint}</p>

      {data.novels.length === 0 && !loading ? (
        <p className="rounded-card border border-dashed border-neutral-300 px-6 py-12 text-center text-sm text-neutral-500">
          ไม่มีนิยายในคิวนี้
        </p>
      ) : (
        <ul className={cn("space-y-3", loading && data.novels.length === 0 && "opacity-50")}>
          {data.novels.map((n) => {
            const c = n.moderation_case;
            const busy = busyId === n.novel_id;
            return (
              <li key={n.novel_id} className="rounded-card border border-neutral-200 bg-white p-4 text-sm">
                <div className="flex gap-3 sm:gap-4">
                  <div className="relative h-24 w-[72px] shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    {n.cover_image_url && <Image src={n.cover_image_url} alt={n.title} fill sizes="72px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 break-words font-semibold text-neutral-900">{n.title}</p>
                      <span className="shrink-0 text-xs text-neutral-400">เผยแพร่ {formatThaiDate(n.created_at)}</span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      โดย{" "}
                      <Link href={`/profile/${n.author.user_id}`} target="_blank" className="text-primary-600 hover:underline">
                        {n.author.pen_name || n.author.username}
                      </Link>{" "}
                      · {n.published_chapter_count.toLocaleString()} ตอนที่เผยแพร่
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-pill bg-neutral-100 px-2 py-0.5 text-neutral-600">{legalStatusLabel[n.legal_status] ?? n.legal_status}</span>
                      <span className="rounded-pill bg-violet-50 px-2 py-0.5 text-violet-700">{ratingLabel[n.content_rating]}</span>
                      {n.open_report_count > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-red-500/10 px-2 py-0.5 font-medium text-red-600">
                          <Flag className="h-3 w-3" /> ถูกรายงาน {n.open_report_count} ครั้ง
                        </span>
                      )}
                      {c && (
                        <span
                          className={cn(
                            "rounded-pill px-2 py-0.5 font-medium",
                            c.status === "appeal_pending" ? "bg-amber-100 text-amber-800" : "bg-red-500/10 text-red-600"
                          )}
                        >
                          {MODERATION_STATUS_LABEL[c.status]}
                          {c.appeal_count > 1 ? ` (ครั้งที่ ${c.appeal_count})` : ""}
                        </span>
                      )}
                      {n.moderation_reviewed_at && !c && (
                        <span className="rounded-pill bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          ตรวจล่าสุด {formatThaiDate(n.moderation_reviewed_at)}
                        </span>
                      )}
                    </div>
                    {n.synopsis && !c && <p className="mt-2 line-clamp-2 break-words text-neutral-600">{n.synopsis}</p>}
                  </div>
                </div>

                {c && (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-300">เหตุผลที่ระงับ · {formatThaiDate(c.created_at)}</p>
                      <p className="mt-0.5 whitespace-pre-line break-words text-neutral-800 dark:text-neutral-100">{c.reason}</p>
                    </div>
                    {c.appeal_message && (
                      <div className="rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          คำอุทธรณ์จากนักเขียน{c.appealed_at ? ` · ${formatThaiDate(c.appealed_at)}` : ""}
                        </p>
                        <p className="mt-0.5 whitespace-pre-line break-words text-neutral-800 dark:text-neutral-100">{c.appeal_message}</p>
                      </div>
                    )}
                    {c.status === "upheld" && c.resolution_note && (
                      <p className="text-xs text-neutral-500">ผลพิจารณาครั้งก่อน: {c.resolution_note}</p>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  {/* ลิงก์ไปหน้านิยาย — แอดมินไม่ใช่เจ้าของ นิยายที่ระงับอยู่จึงเปิดหน้าสาธารณะไม่ได้ */}
                  {n.visibility === "published" && (
                    <Link
                      href={`/novels/${n.novel_id}`}
                      target="_blank"
                      className="mr-auto inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> เปิดอ่าน
                    </Link>
                  )}
                  {n.open_report_count > 0 && (
                    <Link href="/admin/content-reports" className="inline-flex min-h-[44px] items-center text-xs text-neutral-500 hover:underline">
                      ดูรายงาน
                    </Link>
                  )}

                  {!c && tab === "unreviewed" && (
                    <Button variant="outline" size="sm" loading={busy} onClick={handleAsync(() => markReviewed(n))}>
                      <CheckCircle2 className="h-4 w-4" /> ตรวจแล้ว ไม่พบปัญหา
                    </Button>
                  )}
                  {!c && n.visibility !== "suspended" && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => openDialog({ kind: "suspend", novel: n })}
                      className="!bg-red-600 hover:!bg-red-700"
                    >
                      <Ban className="h-4 w-4" /> ระงับ / Take down
                    </Button>
                  )}
                  {c?.status === "appeal_pending" && (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => openDialog({ kind: "uphold", novel: n })}>
                      <ShieldCheck className="h-4 w-4" /> ยืนยันการระงับ
                    </Button>
                  )}
                  {c && (
                    <Button size="sm" disabled={busy} onClick={() => openDialog({ kind: "reinstate", novel: n })}>
                      <RotateCcw className="h-4 w-4" /> {c.status === "appeal_pending" ? "อนุมัติอุทธรณ์ / คืนสถานะ" : "ยกเลิกการระงับ"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(hasMore || loading) && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" disabled={loading} onClick={handleAsync(() => load(tab, data.page + 1))}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "โหลดเพิ่ม"}
          </Button>
        </div>
      )}

      {dialog && (
        <ModalBackdrop className="z-50 items-center bg-black/40 px-4" onDismiss={() => !busyId && setDialog(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="moderation-dialog-title"
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-xl"
          >
            <h2 id="moderation-dialog-title" className="text-h3 text-neutral-900">
              {dialog.kind === "suspend" ? "ระงับนิยาย" : dialog.kind === "uphold" ? "ยืนยันการระงับ" : "คืนสถานะนิยาย"}
            </h2>
            <p className="mt-1 break-words text-sm text-neutral-500">&quot;{dialog.novel.title}&quot;</p>
            <p className="mt-3 text-sm text-neutral-600">
              {dialog.kind === "suspend"
                ? "นิยายจะถูกซ่อนจากผู้อ่านทันที นักเขียนจะได้รับแจ้งเตือนในเว็บและอีเมลพร้อมเหตุผลนี้ และลิงก์สำหรับยื่นอุทธรณ์"
                : dialog.kind === "uphold"
                  ? "นิยายยังถูกระงับต่อไป นักเขียนจะเห็นผลการพิจารณานี้ และแก้ไขแล้วยื่นอุทธรณ์ใหม่ได้"
                  : "นิยายจะกลับไปเป็นสถานะก่อนถูกระงับ (เผยแพร่ = ผู้อ่านเห็นทันที) และแจ้งนักเขียน"}
            </p>
            <div className="mt-4">
              <Textarea
                label={dialog.kind === "suspend" ? "เหตุผลการระงับ (บังคับ)" : dialog.kind === "uphold" ? "ผลการพิจารณา (บังคับ)" : "หมายเหตุถึงนักเขียน (ไม่บังคับ)"}
                name="moderation_text"
                rows={4}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                hint={dialog.kind === "suspend" ? "เช่น มีฉากความรุนแรงโจ่งแจ้งในตอนที่ 3 โดยไม่ได้ตั้งเรต 18+ (แนวทางข้อ 3.2)" : undefined}
                autoFocus
              />
            </div>
            {dialogError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{dialogError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialog(null)} disabled={Boolean(busyId)}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleAsync(submitDialog)}
                loading={busyId === dialog.novel.novel_id}
                disabled={dialog.kind !== "reinstate" && text.trim().length < MIN_REASON}
                className={dialog.kind === "reinstate" ? undefined : "!bg-red-600 hover:!bg-red-700"}
              >
                {dialog.kind === "suspend" ? "ระงับนิยาย" : dialog.kind === "uphold" ? "ยืนยันการระงับ" : "คืนสถานะ"}
              </Button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}
