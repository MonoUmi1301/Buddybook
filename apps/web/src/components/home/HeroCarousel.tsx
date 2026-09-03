"use client";

import { useRef } from "react";
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

const SECONDS_PER_SLIDE = 5;
const GAP_PX = 12; // ต้องตรงกับ gap-3 ที่ track ใช้

// แบนเนอร์สไลด์ด้านบนสุดของ Home — ดู wf_home_dark.png (ป้าย READ&WRITE มุมล่างซ้าย)
// เลื่อนอัตโนมัติต่อเนื่องแบบ marquee (ไม่ต้องกดก็เลื่อนเอง สไตล์ Dek-D/ReadAWrite) ด้วย CSS @keyframes
// ล้วน ๆ (ดู .animate-hero-marquee ใน globals.css) — ไม่ใช้ requestAnimationFrame เพราะควบคุมความ
// ลื่นไหลได้ดีกว่า (compositor thread ล้วน ๆ ไม่ผ่าน JS main thread ทุกเฟรม) ปุ่มลูกศรยังกดเลื่อนเองได้
// ด้วย โดยปรับ animation-delay ของ track ให้ "กระโดด" ไปข้างหน้า/ถอยหลังในไทม์ไลน์ของ animation ที่กำลัง
// รันอยู่ (delay ติดลบมากขึ้น = เสมือนเวลาผ่านไปแล้วมากขึ้น = เลื่อนไปข้างหน้า) แทนการหยุด/restart
// animation ทั้งหมด ต่อ slides ให้วนซ้ำ 1 ชุด แล้ว keyframe เลื่อนไปแค่ครึ่งทาง (-50%) ก็วนกลับจุดเริ่ม
// พอดีแบบไร้รอยต่อ
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const delaySecondsRef = useRef(0);

  if (slides.length === 0) return null;

  const loopSlides = [...slides, ...slides];
  const durationSeconds = Math.max(slides.length, 3) * SECONDS_PER_SLIDE;

  function step(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const loopWidth = track.scrollWidth / 2;
    if (loopWidth <= 0) return;
    const firstCard = track.children[0] as HTMLElement | undefined;
    const cardStep = firstCard ? firstCard.getBoundingClientRect().width + GAP_PX : 300;
    const secondsPerPixel = durationSeconds / loopWidth;
    delaySecondsRef.current -= direction * cardStep * secondsPerPixel;
    track.style.animationDelay = `${delaySecondsRef.current}s`;
  }

  return (
    <div className="group relative overflow-hidden">
      <div
        ref={trackRef}
        className="flex w-max animate-hero-marquee gap-3 group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${durationSeconds}s` }}
      >
        {loopSlides.map((slide, i) => (
          <Link
            key={`${slide.id}-${i}`}
            href={slide.href}
            className="group/card relative aspect-[16/9] w-[240px] shrink-0 overflow-hidden rounded-card bg-surface-muted sm:w-[300px]"
          >
            <Image
              src={slide.coverImageUrl}
              alt={slide.title}
              fill
              sizes="300px"
              className="object-cover transition-transform duration-300 group-hover/card:scale-105"
              priority={i < 3}
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
        onClick={() => step(-1)}
        aria-label="ก่อนหน้า"
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="ถัดไป"
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
