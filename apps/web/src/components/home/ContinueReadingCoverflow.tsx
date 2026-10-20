"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, PlayCircle } from "lucide-react";
import { CoverflowCarousel, type CoverflowSlide } from "@/components/ui/coverflow-carousel";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { formatRelativeThai } from "@/lib/format";
import { getPenName } from "@/lib/displayName";
import { continueHref, coverOf, progressPercent, type ContinueReadingItem } from "@/lib/library";
import Image from "next/image";
import { CAROUSEL_COVER_SIZES } from "@/lib/library";

interface ContinueSlide extends CoverflowSlide {
  href: string;
  percent: number;
  chapter: number;
}

/** ถ้ามีเรื่องค้างอยู่ไม่เกินเท่านี้ แสดงเป็นการ์ดแนวนอนเล็ก ๆ แทน coverflow — เรื่องเดียวใน coverflow
 *  กลายเป็นปกใหญ่โดด ๆ กลางหน้าจอ เด่นกว่าส่วนอื่นของหน้าแรกทั้งที่เป็นแค่ทางลัด */
const COMPACT_MAX_ITEMS = 3;

const layout = {
  desktop: { cardWidth: "clamp(170px, 14vw, 210px)", rotate: 40, nav: true },
  tablet: { cardWidth: "200px", rotate: 40, nav: true },
  mobile: { cardWidth: "clamp(150px, 46vw, 200px)", rotate: 50, nav: false },
} as const;

/** "อ่านต่อ" หน้าแรก — จาก GET /library/continue-reading (ไม่ autoplay ตาม spec) */
export function ContinueReadingCoverflow({
  items: initialItems,
  isLoggedIn = false,
}: {
  items: ContinueReadingItem[];
  /** ล็อกอินอยู่ = ดึงรายการใหม่ฝั่ง client ด้วย (ดู effect ข้างล่าง) */
  isLoggedIn?: boolean;
}) {
  const router = useRouter();
  const { breakpoint } = useBreakpoint();
  const [active, setActive] = useState(0);
  const [items, setItems] = useState(initialItems);
  const cfg = layout[breakpoint];

  // อ่านจบแล้วกดย้อนกลับมาหน้าแรก รายการ "อ่านต่อ" ไม่อัปเดตจนกว่าจะรีเฟรช — ปุ่ม Back ใช้หน้าเดิมจาก
  // Router Cache/bfcache (staleTimes ไม่มีผลกับ back/forward) และความคืบหน้าบันทึกแบบ async หลัง render ไปแล้ว
  // จึงดึงใหม่เองตอน mount, ตอนกลับมาจาก bfcache และตอนสลับแท็บกลับมา
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    const refresh = () => {
      fetch("/api/v1/library/continue-reading?limit=10", { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<{ items: ContinueReadingItem[] }>) : null))
        .then((json) => {
          if (json && !cancelled) setItems(json.items);
        })
        .catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isLoggedIn]);

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
  const compact = slides.length <= COMPACT_MAX_ITEMS;

  return (
    <section aria-labelledby="continue-heading" className="py-10 max-lg:py-8 max-md:py-6">
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

        {compact ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slides.map((slide) => (
              <li key={slide.href}>
                <ContinueCard slide={slide} />
              </li>
            ))}
          </ul>
        ) : (
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
        )}
      </div>
    </section>
  );
}

/** การ์ดแนวนอน: ปกเล็ก + ชื่อเรื่อง + ความคืบหน้า — กดได้ทั้งใบ พาไปตอนที่อ่านค้าง */
function ContinueCard({ slide }: { slide: ContinueSlide }) {
  const lastRead = slide.meta?.find((m) => m.label === "อ่านล่าสุด")?.value;
  return (
    <Link
      href={slide.href}
      className="group flex h-full items-center gap-4 rounded-card border border-neutral-200 bg-white p-3 transition-colors hover:border-primary-300 hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100 shadow-sm">
        <Image src={slide.src} alt={slide.alt} fill sizes="64px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold text-neutral-900 group-hover:text-primary-700">{slide.title}</p>
        {slide.subtitle && <p className="mt-0.5 truncate text-xs text-neutral-500">{slide.subtitle}</p>}
        <div
          className="mt-2 h-1 overflow-hidden rounded-pill bg-neutral-100"
          role="progressbar"
          aria-valuenow={slide.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="ความคืบหน้าการอ่าน"
        >
          <div className="h-full rounded-pill bg-primary-400" style={{ width: `${slide.percent}%` }} />
        </div>
        <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-neutral-500">
          <span className="truncate">
            ตอนที่ {slide.chapter}
            {lastRead ? ` · ${lastRead}` : ""}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary-600">
            อ่านต่อ <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </p>
      </div>
    </Link>
  );
}

export function ProgressCover({ slide }: { slide: { src: string; alt: string; percent: number } }) {
  return (
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
