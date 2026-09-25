"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, PlayCircle } from "lucide-react";
import { CoverflowCarousel, type CoverflowSlide } from "@/components/ui/coverflow-carousel";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { formatRelativeThai } from "@/lib/format";
import { getPenName } from "@/lib/displayName";
import { continueHref, coverOf, progressPercent, type ContinueReadingItem } from "@/lib/library";

interface ContinueSlide extends CoverflowSlide {
  href: string;
  percent: number;
  chapter: number;
}

const layout = {
  desktop: { cardWidth: "clamp(200px, 17vw, 240px)", rotate: 40, nav: true },
  tablet: { cardWidth: "200px", rotate: 40, nav: true },
  mobile: { cardWidth: "clamp(150px, 46vw, 200px)", rotate: 50, nav: false },
} as const;

/** "อ่านต่อ" หน้าแรก — จาก GET /library/continue-reading (ไม่ autoplay ตาม spec) */
export function ContinueReadingCoverflow({ items }: { items: ContinueReadingItem[] }) {
  const router = useRouter();
  const { breakpoint } = useBreakpoint();
  const [active, setActive] = useState(0);
  const cfg = layout[breakpoint];

  if (items.length === 0) return null;

  const slides: ContinueSlide[] = items.map(({ novel, progress }) => ({
    src: coverOf(novel),
    alt: `ปก ${novel.title}`,
    title: novel.title,
    subtitle: getPenName(novel.author),
    href: continueHref(novel.novel_id, progress),
    percent: progressPercent(progress, novel.chapter_count),
    chapter: progress.last_chapter_number,
    meta: [
      { label: "ความคืบหน้า", value: `ตอนที่ ${progress.last_chapter_number} / ${novel.chapter_count}` },
      { label: "อ่านล่าสุด", value: formatRelativeThai(progress.last_read_at) },
    ],
  }));
  const current = slides[active] ?? slides[0];

  return (
    <section aria-labelledby="continue-heading" className="py-16 max-lg:py-12 max-md:py-8">
      <div className="mx-auto max-w-[1400px] px-8 max-lg:px-6 max-md:px-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="continue-heading" className="text-h2 text-neutral-900 max-md:text-2xl">
            อ่านต่อจากที่ค้างไว้
          </h2>
          <Link
            href="/library"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
          >
            ชั้นหนังสือของฉัน <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <CoverflowCarousel
          slides={slides}
          aspectRatio={2 / 3}
          cardWidth={cfg.cardWidth}
          rotate={cfg.rotate}
          showCaption
          compactCaption={breakpoint === "mobile"}
          showNavigation={cfg.nav && slides.length > 1}
          loop={slides.length > 2}
          label="อ่านต่อ"
          className="mt-2"
          onSelectChange={setActive}
          onActivate={(i) => router.push(slides[i].href)}
          renderCard={(slide) => <ProgressCover slide={slide} />}
          captionExtra={
            <Link
              href={current.href}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-primary-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
            >
              <PlayCircle className="h-4 w-4" />
              อ่านต่อ ตอนที่ {current.chapter}
            </Link>
          }
        />
      </div>
    </section>
  );
}

export function ProgressCover({ slide }: { slide: { src: string; alt: string; percent: number } }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- ปกภายนอก + carousel วาด transform เอง */}
      <img src={slide.src} alt={slide.alt} draggable={false} className="h-full w-full select-none object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8">
        <div
          className="h-1.5 overflow-hidden rounded-pill bg-white/30"
          role="progressbar"
          aria-valuenow={slide.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="ความคืบหน้าการอ่าน"
        >
          <div className="h-full rounded-pill bg-primary-400" style={{ width: `${slide.percent}%` }} />
        </div>
        <p className="mt-1 text-right text-[11px] font-medium text-white/90">{slide.percent}%</p>
      </div>
    </>
  );
}
