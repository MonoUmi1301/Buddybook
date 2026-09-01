"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface HeroSlide {
  id: string;
  title: string;
  coverImageUrl: string;
  href: string;
}

// แบนเนอร์สไลด์ด้านบนสุดของ Home — ดู wf_home_dark.png (3 การ์ดโชว์พร้อมกัน, ป้าย READ&WRITE มุมล่างซ้าย)
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [startIndex, setStartIndex] = useState(0);
  const visibleCount = 3;
  const maxStart = Math.max(0, slides.length - visibleCount);

  function prev() {
    setStartIndex((i) => Math.max(0, i - 1));
  }
  function next() {
    setStartIndex((i) => Math.min(maxStart, i + 1));
  }

  const visibleSlides = slides.slice(startIndex, startIndex + visibleCount);

  return (
    <div className="relative">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {visibleSlides.map((slide) => (
          <Link
            key={slide.id}
            href={slide.href}
            className="group relative aspect-[16/9] overflow-hidden rounded-card bg-surface-muted"
          >
            <Image
              src={slide.coverImageUrl}
              alt={slide.title}
              fill
              sizes="(min-width: 640px) 33vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-xs font-semibold tracking-wide text-white">
              READ&amp;WRITE
            </span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={prev}
        disabled={startIndex === 0}
        aria-label="ก่อนหน้า"
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-black/70",
          "disabled:pointer-events-none disabled:opacity-0"
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={next}
        disabled={startIndex >= maxStart}
        aria-label="ถัดไป"
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-black/70",
          "disabled:pointer-events-none disabled:opacity-0"
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
