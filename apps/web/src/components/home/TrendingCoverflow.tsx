"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { CoverflowCarousel, type CoverflowSlide } from "@/components/ui/coverflow-carousel";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import Image from "next/image";
import { CAROUSEL_COVER_SIZES } from "@/lib/library";

export interface TrendingSlide extends CoverflowSlide {
  href: string;
  rank: number;
}

interface TrendingCoverflowProps {
  slides: TrendingSlide[];
  seeAllHref: string;
}

/** ตามตาราง responsive: การ์ด ~240 / 200 / clamp(150px,46vw,200px), หมุน 40 / 40 / 50,
 *  มือถือไม่มีลูกศร (ปัดเอา) และไม่ autoplay */
const layout = {
  desktop: { cardWidth: "clamp(200px, 17vw, 240px)", rotate: 40, nav: true, autoplay: 5000 },
  tablet: { cardWidth: "200px", rotate: 40, nav: true, autoplay: 5000 },
  mobile: { cardWidth: "clamp(150px, 46vw, 200px)", rotate: 50, nav: false, autoplay: undefined },
} as const;

/** แถบ "มาแรงตอนนี้" เต็มความกว้าง — ปกแนวตั้ง 2:3 + ป้ายอันดับ แตะการ์ดกลาง/Enter = เปิดเรื่อง */
export function TrendingCoverflow({ slides, seeAllHref }: TrendingCoverflowProps) {
  const router = useRouter();
  const { breakpoint } = useBreakpoint();
  const [active, setActive] = useState(0);
  const cfg = layout[breakpoint];

  if (slides.length === 0) return null;
  const current = slides[active] ?? slides[0];

  return (
    <section aria-labelledby="trending-heading" className="bg-neutral-100/60 py-16 max-lg:py-12 max-md:py-8">
      <div className="mx-auto max-w-[1400px] px-8 max-lg:px-6 max-md:px-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="trending-heading" className="text-h2 text-neutral-900 max-md:text-2xl">
              มาแรงตอนนี้
            </h2>
            <p className="mt-1 text-sm text-neutral-500 max-md:hidden">เรียงตามยอดอ่าน — ลาก ปัด หรือใช้ลูกศรเพื่อเลื่อน</p>
          </div>
          <Link
            href={seeAllHref}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
          >
            ดูทั้งหมด <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <CoverflowCarousel
          slides={slides}
          aspectRatio={2 / 3}
          cardWidth={cfg.cardWidth}
          rotate={cfg.rotate}
          showCaption
          compactCaption={breakpoint === "mobile"}
          showNavigation={cfg.nav}
          autoplay={cfg.autoplay}
          label="นิยายมาแรง"
          className="mt-2"
          onSelectChange={setActive}
          onActivate={(i) => router.push(slides[i].href)}
          renderCard={(slide) => (
            <>
              <Image
                src={slide.src}
                alt={slide.alt}
                width={400}
                height={600}
                sizes={CAROUSEL_COVER_SIZES}
                draggable={false}
                className="h-full w-full select-none object-cover"
              />
              <span className="absolute left-2 top-2 rounded-lg bg-black/65 px-2 py-0.5 text-sm font-bold text-white backdrop-blur">
                #{slide.rank}
              </span>
            </>
          )}
          captionExtra={
            <Link
              href={current.href}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-primary-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
            >
              <BookOpen className="h-4 w-4" />
              อ่านเลย
            </Link>
          }
        />
      </div>
    </section>
  );
}
