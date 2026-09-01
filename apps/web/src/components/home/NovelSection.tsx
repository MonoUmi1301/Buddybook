"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NovelCard } from "@/components/home/NovelCard";
import { cn } from "@/lib/cn";
import type { NovelSummary } from "@/lib/types";

/** แถวการ์ดนิยายเลื่อนแนวนอน — เดิมมีแค่ overflow-x-auto เฉย ๆ ซึ่งเลื่อนได้จริงด้วย trackpad/
 *  shift+wheel แต่ไม่มี affordance ให้เห็นว่าเลื่อนได้ ผู้ใช้เมาส์ปกติมองไม่ออก จึงเพิ่มปุ่มลูกศร
 *  ให้กดเลื่อนได้ตรง ๆ (แบบเดียวกับ HeroCarousel) ซ่อนปุ่มอัตโนมัติเมื่อเลื่อนสุดด้านนั้นแล้ว */
function NovelRow({ novels, theme }: { novels: NovelSummary[]; theme: "dark" | "light" }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollByAmount(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  return (
    <div className="group/row relative">
      <div
        ref={scrollRef}
        className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {novels.map((novel) => (
          <NovelCard key={novel.id} novel={novel} theme={theme} />
        ))}
      </div>

      {novels.length > 3 && (
        <>
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            aria-label="เลื่อนไปทางซ้าย"
            className="absolute left-0 top-[35%] hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover/row:opacity-100 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            aria-label="เลื่อนไปทางขวา"
            className="absolute right-0 top-[35%] hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover/row:opacity-100 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

interface NovelSectionProps {
  title: string;
  emoji?: string;
  viewAllHref?: string;
  novels?: NovelSummary[];
  subRows?: { label: string; novels: NovelSummary[] }[];
  theme?: "dark" | "light";
}

/** แถวหมวดหมู่นิยาย พร้อมหัวข้อ + ลิงก์ "ดูทั้งหมด" — ดู wf_home_dark.png (Love novel, Boy love, ...) */
export function NovelSection({
  title,
  emoji,
  viewAllHref = "#",
  novels,
  subRows,
  theme = "dark",
}: NovelSectionProps) {
  const isDark = theme === "dark";

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2
          className={cn(
            "flex items-center gap-1.5 text-h3",
            isDark ? "text-zinc-100" : "text-neutral-900"
          )}
        >
          {title}
          {emoji && <span aria-hidden>{emoji}</span>}
        </h2>
        <Link
          href={viewAllHref}
          className={cn(
            "flex items-center gap-0.5 text-xs font-medium transition-colors",
            isDark ? "text-primary-400 hover:text-primary-300" : "text-primary-600 hover:text-primary-700"
          )}
        >
          ดูทั้งหมด
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {subRows ? (
        <div className="space-y-5">
          {subRows.map((row) => (
            <div key={row.label}>
              <p
                className={cn(
                  "mb-2 text-sm font-medium",
                  isDark ? "text-neutral-400" : "text-neutral-500"
                )}
              >
                {row.label}
              </p>
              <NovelRow novels={row.novels} theme={theme} />
            </div>
          ))}
        </div>
      ) : (
        novels && <NovelRow novels={novels} theme={theme} />
      )}
    </section>
  );
}
