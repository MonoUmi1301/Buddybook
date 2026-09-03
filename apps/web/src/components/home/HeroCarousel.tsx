"use client";

import Image from "next/image";
import Link from "next/link";

export interface HeroSlide {
  id: string;
  title: string;
  coverImageUrl: string;
  href: string;
}

const SECONDS_PER_SLIDE = 5;

// แบนเนอร์สไลด์ด้านบนสุดของ Home — ดู wf_home_dark.png (ป้าย READ&WRITE มุมล่างซ้าย)
// เปลี่ยนจากปุ่มเลื่อนทีละใบ เป็นเลื่อนอัตโนมัติต่อเนื่องแบบ marquee (ไม่ต้องกด) ตามที่ขอ — สไตล์เดียว
// กับแบนเนอร์ของ Dek-D/ReadAWrite ต่อ slides ให้วนซ้ำ 1 ชุด แล้วเลื่อน track ไปแค่ครึ่งทาง (translateX
// -50%) ก็จะวนกลับมาจุดเดิมพอดีแบบไร้รอยต่อ (seamless loop) หยุดเลื่อนตอน hover ให้กดการ์ดได้สะดวก
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  if (slides.length === 0) return null;

  const loopSlides = [...slides, ...slides];
  const durationSeconds = Math.max(slides.length, 3) * SECONDS_PER_SLIDE;

  return (
    <div className="group relative overflow-hidden">
      <div
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
    </div>
  );
}
