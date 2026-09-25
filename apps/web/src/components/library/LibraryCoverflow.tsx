"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, PlayCircle } from "lucide-react";
import { CoverflowCarousel, type CoverflowSlide } from "@/components/ui/coverflow-carousel";
import { ProgressCover } from "@/components/home/ContinueReadingCoverflow";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { formatRelativeThai } from "@/lib/format";
import { getPenName } from "@/lib/displayName";
import {
  continueHref,
  coverOf,
  libraryStatusLabel,
  progressPercent,
  type LibraryEntry,
  type LibraryStatus,
} from "@/lib/library";

interface Slide extends CoverflowSlide {
  entry: LibraryEntry;
  percent: number;
}

interface LibraryCoverflowProps {
  title: string;
  entries: LibraryEntry[];
  onStatusChange: (novelId: string, status: LibraryStatus) => void;
}

const layout = {
  desktop: { cardWidth: "clamp(190px, 15vw, 230px)", rotate: 40, nav: true },
  tablet: { cardWidth: "190px", rotate: 40, nav: true },
  mobile: { cardWidth: "clamp(150px, 46vw, 190px)", rotate: 50, nav: false },
} as const;

function metaFor(entry: LibraryEntry) {
  const { progress, novel } = entry;
  return [
    {
      label: "ความคืบหน้า",
      value: progress ? `ตอนที่ ${progress.last_chapter_number} / ${novel.chapter_count}` : `ยังไม่เริ่ม · ${novel.chapter_count} ตอน`,
    },
    { label: "อ่านล่าสุด", value: progress ? formatRelativeThai(progress.last_read_at) : "–" },
    { label: "สถานะ", value: libraryStatusLabel[entry.status] },
  ];
}

/** Coverflow ในหน้า My Library — ≥1280px มีแผงข้างขวา (ความคืบหน้า/ปุ่ม/สถานะ) แทน caption ใต้ภาพ */
export function LibraryCoverflow({ title, entries, onStatusChange }: LibraryCoverflowProps) {
  const router = useRouter();
  const { breakpoint } = useBreakpoint();
  const [active, setActive] = React.useState(0);
  const cfg = layout[breakpoint];

  // รายการเปลี่ยนตามตัวกรอง — กลับไปเรื่องแรกกัน index ชี้เกินรายการ
  const key = entries.map((e) => e.novel.novel_id).join(",");
  React.useEffect(() => setActive(0), [key]);

  if (entries.length === 0) return null;

  const slides: Slide[] = entries.map((entry) => ({
    src: coverOf(entry.novel),
    alt: `ปก ${entry.novel.title}`,
    title: entry.novel.title,
    subtitle: getPenName(entry.novel.author),
    meta: metaFor(entry),
    entry,
    percent: progressPercent(entry.progress, entry.novel.chapter_count),
  }));
  const current = slides[Math.min(active, slides.length - 1)];

  const actions = (
    <div className="flex flex-col gap-2">
      <Link
        href={continueHref(current.entry.novel.novel_id, current.entry.progress)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-primary-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
      >
        <PlayCircle className="h-4 w-4" />
        {current.entry.progress ? `อ่านต่อ ตอนที่ ${current.entry.progress.last_chapter_number}` : "เริ่มอ่าน"}
      </Link>
      <Link
        href={`/novels/${current.entry.novel.novel_id}`}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-pill border border-neutral-300 bg-white px-5 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-600"
      >
        <Info className="h-4 w-4" />
        รายละเอียด
      </Link>
    </div>
  );

  return (
    <section aria-labelledby="library-coverflow-heading">
      <h2 id="library-coverflow-heading" className="text-h3 text-neutral-900 max-md:text-xl max-md:font-semibold">
        {title} <span className="text-base font-normal text-neutral-400">({entries.length})</span>
      </h2>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-center gap-10 max-xl:grid-cols-1 max-xl:gap-0">
        <CoverflowCarousel
          key={key}
          slides={slides}
          aspectRatio={2 / 3}
          cardWidth={cfg.cardWidth}
          rotate={cfg.rotate}
          showCaption
          captionClassName="hidden max-xl:flex"
          compactCaption={breakpoint === "mobile"}
          showNavigation={cfg.nav && slides.length > 1}
          loop={slides.length > 2}
          label={title}
          onSelectChange={setActive}
          onActivate={(i) => router.push(continueHref(slides[i].entry.novel.novel_id, slides[i].entry.progress))}
          renderCard={(slide) => <ProgressCover slide={slide} />}
          captionExtra={actions}
        />

        {/* แผงข้าง ≥1280px */}
        <aside
          key={current.entry.novel.novel_id}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm duration-300 animate-in fade-in max-xl:hidden"
          aria-live="polite"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-primary-500">{libraryStatusLabel[current.entry.status]}</p>
          <h3 className="mt-1 line-clamp-2 text-xl font-bold leading-snug text-neutral-900">{current.entry.novel.title}</h3>
          <p className="mt-1 text-sm text-neutral-500">{getPenName(current.entry.novel.author)}</p>

          <div className="mt-5">
            <div className="flex justify-between text-xs text-neutral-500">
              <span>
                {current.entry.progress
                  ? `ตอนที่ ${current.entry.progress.last_chapter_number} / ${current.entry.novel.chapter_count}`
                  : `ยังไม่เริ่ม · ${current.entry.novel.chapter_count} ตอน`}
              </span>
              <span className="font-medium text-neutral-800">{current.percent}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-neutral-100">
              <div className="h-full rounded-pill bg-primary-500" style={{ width: `${current.percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              อ่านล่าสุด {current.entry.progress ? formatRelativeThai(current.entry.progress.last_read_at) : "–"}
            </p>
          </div>

          <label className="mt-5 block text-xs text-neutral-500">
            สถานะในชั้น
            <select
              value={current.entry.status}
              onChange={(e) => onStatusChange(current.entry.novel.novel_id, e.target.value as LibraryStatus)}
              className="mt-1 block h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30"
            >
              {(Object.keys(libraryStatusLabel) as LibraryStatus[]).map((s) => (
                <option key={s} value={s}>
                  {libraryStatusLabel[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5">{actions}</div>
        </aside>
      </div>
    </section>
  );
}
