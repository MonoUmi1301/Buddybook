"use client";

import { useEffect, useRef, useState } from "react";
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

const VISIBLE_COUNT = 3;
const HOLD_MS = 4000; // ค้างไว้เท่านี้ก่อนเลื่อนไปข้างหน้าทีละใบอัตโนมัติ
const PAUSE_AFTER_MANUAL_MS = 6000; // กดปุ่ม/จุดเองแล้ว หยุด autoplay ชั่วคราวก่อนเริ่มนับใหม่
const GAP_PX = 12; // ต้องตรงกับ gap-3 ที่ track ใช้

// แบนเนอร์สไลด์ด้านบนสุดของ Home — ดู wf_home_dark.png (ป้าย READ&WRITE มุมล่างซ้าย)
// โชว์ 3 ใบพร้อมกันเสมอ ค้างไว้ HOLD_MS แล้วเลื่อนไปข้างหน้าทีละ 1 ใบ (เช่น slides 1,2,3 -> 2,3,4)
// ไม่ใช่กระโดดทีละหน้า พอเลื่อนจนสุด (ไม่พอครบ 3 ใบถัดไปแล้ว) ก็วนกลับไปเริ่มที่ใบแรกใหม่ — ย้าย
// track ด้วย transform บวก CSS transition (ไม่ใช้ requestAnimationFrame เพราะเป็นการขยับทีละสเต็ป
// ไม่ต่อเนื่องแบบ marquee ให้ CSS จัดการ interpolation เองพอ) ปุ่มลูกศร/จุดด้านล่างกดเลื่อนเองได้ด้วย
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [startIndex, setStartIndex] = useState(0);
  const pausedRef = useRef(false);

  const maxStart = Math.max(0, slides.length - VISIBLE_COUNT);

  function applyOffset(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.children[0] as HTMLElement | undefined;
    const cardStep = firstCard ? firstCard.getBoundingClientRect().width + GAP_PX : 0;
    track.style.transform = `translateX(-${index * cardStep}px)`;
  }

  useEffect(() => {
    applyOffset(startIndex);
    const onResize = () => applyOffset(startIndex);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex]);

  useEffect(() => {
    if (maxStart <= 0) return;
    const timer = setInterval(() => {
      if (!pausedRef.current) {
        setStartIndex((i) => (i >= maxStart ? 0 : i + 1));
      }
    }, HOLD_MS);
    return () => clearInterval(timer);
  }, [maxStart]);

  if (slides.length === 0) return null;

  function goTo(next: number) {
    setStartIndex(next < 0 ? maxStart : next > maxStart ? 0 : next);
    pausedRef.current = true;
    setTimeout(() => {
      pausedRef.current = false;
    }, PAUSE_AFTER_MANUAL_MS);
  }

  return (
    <div
      className="group relative overflow-hidden"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      <div ref={trackRef} className="flex gap-3 transition-transform duration-500 ease-out">
        {slides.map((slide, i) => (
          <Link
            key={slide.id}
            href={slide.href}
            className="group/card relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-card bg-surface-muted sm:w-[calc((100%-1.5rem)/3)]"
          >
            <Image
              src={slide.coverImageUrl}
              alt={slide.title}
              fill
              sizes="(min-width: 640px) 33vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover/card:scale-105"
              priority={i < VISIBLE_COUNT}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-xs font-semibold tracking-wide text-white">
              READ&amp;WRITE
            </span>
          </Link>
        ))}
      </div>

      {maxStart > 0 && (
        <>
          <button
            type="button"
            onClick={() => goTo(startIndex - 1)}
            aria-label="ก่อนหน้า"
            className={cn(
              "absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(startIndex + 1)}
            aria-label="ถัดไป"
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 right-3 flex gap-1.5">
            {Array.from({ length: maxStart + 1 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`ไปตำแหน่ง ${i + 1}`}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === startIndex ? "bg-white" : "bg-white/40"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
