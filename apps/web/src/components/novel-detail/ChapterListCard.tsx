"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatThaiDate } from "@/lib/format";

export interface ChapterListItem {
  chapter_id: string;
  chapter_number: number;
  title: string;
  /** เจ้าของนิยายเห็นตอนที่ยังไม่เผยแพร่ด้วย (draft/scheduled/hidden) — คนอื่นเห็นแค่ published */
  status: "draft" | "published" | "scheduled" | "hidden";
  word_count: number;
  published_at: string | null;
  scheduled_publish_at?: string | null;
}

interface ChapterListCardProps {
  novelId: string;
  chapters: ChapterListItem[];
}

const PAGE_SIZE = 30;

const unpublishedLabel: Record<Exclude<ChapterListItem["status"], "published">, string> = {
  draft: "ฉบับร่าง",
  scheduled: "ตั้งเวลาไว้",
  hidden: "ซ่อนอยู่",
};

/** แท็บ "สารบัญ" — สลับเรียงตอนแรก/ตอนล่าสุดก่อน + แสดงทีละ 30 ตอนกันหน้ายาวเกิน */
export function ChapterListCard({ novelId, chapters }: ChapterListCardProps) {
  const [newestFirst, setNewestFirst] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const sorted = useMemo(
    () =>
      [...chapters].sort((a, b) =>
        newestFirst ? b.chapter_number - a.chapter_number : a.chapter_number - b.chapter_number
      ),
    [chapters, newestFirst]
  );
  const publishedCount = chapters.filter((c) => c.status === "published").length;

  if (chapters.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-sm text-neutral-400">
        ยังไม่มีตอนที่เผยแพร่
      </div>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          เผยแพร่แล้ว <span className="font-semibold text-neutral-800">{publishedCount.toLocaleString()}</span> ตอน
        </p>
        <button
          type="button"
          onClick={() => setNewestFirst((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-neutral-200 bg-white px-3 text-sm text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-600"
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          {newestFirst ? "ตอนล่าสุดก่อน" : "ตอนแรกก่อน"}
        </button>
      </div>

      <ol className="space-y-2">
        {sorted.slice(0, visible).map((ch) => {
          const date = ch.published_at ?? ch.scheduled_publish_at;
          return (
            <li key={ch.chapter_id}>
              <Link
                href={`/novels/${novelId}/chapters/${ch.chapter_id}`}
                className="group flex items-center gap-4 rounded-card border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-primary-300 hover:bg-primary-500/5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-sm font-semibold text-primary-600">
                  {ch.chapter_number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-neutral-800 group-hover:text-primary-600">
                    {ch.title}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-400">
                    {date && <span>{formatThaiDate(date)}</span>}
                    {ch.word_count > 0 && <span>· {ch.word_count.toLocaleString()} ตัวอักษร</span>}
                    {ch.status !== "published" && (
                      <span
                        className={cn(
                          "rounded-pill bg-neutral-100 px-2 py-0.5 font-medium text-neutral-500",
                          ch.status === "scheduled" && "bg-sky-500/10 text-sky-600"
                        )}
                      >
                        {unpublishedLabel[ch.status]}
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500" />
              </Link>
            </li>
          );
        })}
      </ol>

      {sorted.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mt-3 w-full rounded-card border border-neutral-200 bg-white py-2.5 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-500/5"
        >
          แสดงเพิ่มอีก {Math.min(PAGE_SIZE, sorted.length - visible)} ตอน
          <span className="ml-1 text-neutral-400">(เหลือ {(sorted.length - visible).toLocaleString()})</span>
        </button>
      )}
    </section>
  );
}
