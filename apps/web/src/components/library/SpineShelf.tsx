"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { ShelfTitle } from "@/components/library/ShelfTitle";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { Dialog, hashString, useDismiss } from "@/components/library/shelf-utils";
import { getPenName } from "@/lib/displayName";
import {
  collectionTintRgb,
  continueHref,
  coverOf,
  libraryStatusLabel,
  progressPercent,
  type LibraryEntry,
  type LibraryNovel,
} from "@/lib/library";
import type { ShelfGroup } from "@/components/library/AcrylicShelf";

/** โทนสันหนังสือ — [พื้น, ตัวอักษร] อิงสีแบรนด์ (ส้ม/น้ำตาล/แทน) ผสมโทนหม่นให้ดูเป็นชั้นหนังสือจริง */
const SPINE_COLORS: [string, string][] = [
  ["#5B3A29", "#F8EBDD"],
  ["#F0803C", "#FFFFFF"],
  ["#D9A879", "#3B2418"],
  ["#2F4858", "#E6EEF2"],
  ["#8A5A3F", "#FBEFE3"],
  ["#C0504D", "#FFF3F0"],
  ["#6B7F5E", "#F1F5EC"],
  ["#E8DCC8", "#4A3426"],
  ["#3D3A5C", "#ECEAF7"],
  ["#B8551E", "#FFF1E6"],
];

function spineStyle(novelId: string) {
  const h = hashString(novelId);
  const [bg, fg] = SPINE_COLORS[h % SPINE_COLORS.length];
  return {
    width: 36 + ((h >>> 4) % 29), // 36–64px
    height: 180 + ((h >>> 9) % 56), // 180–235px
    bg,
    fg,
    band: (h >>> 14) % 3 !== 0, // แถบคาดสันบางเล่ม
  };
}

interface SpineShelfProps {
  group: ShelfGroup;
  entries: Map<string, LibraryEntry>;
}

/**
 * ชั้นสันหนังสือ — ขนาด/สีคงที่ตาม hash ของ novel_id (ไม่สุ่มใหม่ทุก render)
 * - เมาส์: hover ยกขึ้น + ป๊อปอัปปก, คลิก = เปิดเรื่อง
 * - แท็บเล็ต (สัมผัส): แตะ = โชว์ปก, แตะซ้ำ = เปิด
 * - มือถือ: แตะ = bottom sheet (ปก ชื่อ ปุ่มอ่านต่อ)
 */
export function SpineShelf({ group, entries }: SpineShelfProps) {
  const router = useRouter();
  const { breakpoint, canHover } = useBreakpoint();
  const [peek, setPeek] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<LibraryNovel | null>(null);
  const clearPeek = React.useCallback(() => setPeek(null), []);
  const rowRef = useDismiss<HTMLDivElement>(peek !== null, clearPeek);
  const headingId = React.useId();

  function onSpineClick(e: React.MouseEvent, novel: LibraryNovel) {
    if (canHover) return; // ปล่อยให้ลิงก์ทำงานตามปกติ
    e.preventDefault();
    if (breakpoint === "mobile") {
      setSheet(novel);
      return;
    }
    if (peek === novel.novel_id) router.push(`/novels/${novel.novel_id}`);
    else setPeek(novel.novel_id);
  }

  const sheetEntry = sheet ? entries.get(sheet.novel_id) : undefined;

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 id={headingId} className="text-lg font-semibold text-neutral-900 max-md:text-base">
          <ShelfTitle name={group.name} icon={group.icon} tintRgb={group.tint ? collectionTintRgb[group.tint] : undefined} />
        </h3>
        <span className="text-sm text-neutral-500">{group.novels.length} เรื่อง</span>
      </div>

      <div ref={rowRef} className="relative">
        {group.novels.length === 0 ? (
          <p className="border-b-4 border-neutral-300 py-10 text-sm text-neutral-400">ยังไม่มีนิยายในชั้นนี้</p>
        ) : (
          <div className="scrollbar-hide flex items-end gap-1 overflow-x-auto border-b-[6px] border-brand-brown/70 px-2 dark:border-brand-tan/50" style={{ paddingTop: canHover || breakpoint === "tablet" ? 160 : 16 }}>
            {group.novels.map((novel) => {
              const s = spineStyle(novel.novel_id);
              const peeking = peek === novel.novel_id;
              return (
                <Link
                  key={novel.novel_id}
                  href={`/novels/${novel.novel_id}`}
                  onClick={(e) => onSpineClick(e, novel)}
                  aria-label={`${novel.title} โดย ${getPenName(novel.author)}`}
                  className={cn(
                    "group relative flex shrink-0 items-center justify-center rounded-t-[3px] shadow-[inset_-3px_0_6px_rgba(0,0,0,0.18),inset_2px_0_2px_rgba(255,255,255,0.12)] transition-transform duration-200",
                    "hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    peeking && "-translate-y-1"
                  )}
                  style={{ width: s.width, height: s.height, backgroundColor: s.bg, color: s.fg }}
                >
                  {s.band && <span aria-hidden className="absolute inset-x-0 top-5 h-1.5 bg-current opacity-30" />}
                  <span
                    aria-hidden
                    className="line-clamp-1 max-h-[85%] overflow-hidden text-xs font-semibold tracking-wide"
                    style={{ writingMode: "vertical-rl" }}
                  >
                    {novel.title}
                  </span>

                  {/* ปกลอยเหนือสัน: hover/focus บนเมาส์, แตะครั้งแรกบนแท็บเล็ต */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-24 -translate-x-1/2 overflow-hidden rounded-md shadow-xl ring-1 ring-black/10 transition-opacity duration-150",
                      canHover
                        ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                        : peeking
                          ? "opacity-100"
                          : "opacity-0"
                    )}
                  >
                    <Image src={coverOf(novel)} alt="" width={400} height={600} sizes="160px" className="aspect-[2/3] w-full object-cover" />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={sheet !== null} title={sheet?.title ?? ""} onClose={() => setSheet(null)}>
        {sheet && (
          <div className="flex gap-4">
            <Image src={coverOf(sheet)} alt="" width={400} height={600} sizes="96px" className="aspect-[2/3] w-24 shrink-0 rounded-md object-cover shadow-md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-neutral-500">{getPenName(sheet.author)}</p>
              {sheetEntry && (
                <p className="mt-1 text-xs text-neutral-500">
                  {libraryStatusLabel[sheetEntry.status]}
                  {sheetEntry.progress &&
                    ` · ตอนที่ ${sheetEntry.progress.last_chapter_number}/${sheet.chapter_count} (${progressPercent(sheetEntry.progress, sheet.chapter_count)}%)`}
                </p>
              )}
              <Link
                href={continueHref(sheet.novel_id, sheetEntry?.progress ?? null)}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-primary-500 text-sm font-semibold text-white hover:bg-primary-600"
              >
                <PlayCircle className="h-4 w-4" />
                {sheetEntry?.progress ? `อ่านต่อ ตอนที่ ${sheetEntry.progress.last_chapter_number}` : "ดูรายละเอียด"}
              </Link>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
