"use client";

import Link from "next/link";
import { BookOpen, Compass } from "lucide-react";
import { ImageAccordion, type ImageAccordionItem } from "@/components/ui/image-accordion";

interface FeaturedHeroProps {
  items: ImageAccordionItem[];
  /** ลิงก์ปุ่ม "เริ่มอ่าน" — เรื่องอันดับ 1 */
  startHref: string;
  exploreHref: string;
}

/**
 * Hero หน้าแรก "แนะนำประจำสัปดาห์" — แทน HeroCarousel เดิม
 * Desktop-first: 2 คอลัมน์ (ข้อความ 45% / accordion 55%), แท็บเล็ต 40/60, มือถือเรียงซ้อนกลางจอ
 */
export function FeaturedHero({ items, startHref, exploreHref }: FeaturedHeroProps) {
  return (
    <section
      aria-labelledby="featured-heading"
      className="grid grid-cols-[minmax(0,45fr)_minmax(0,55fr)] items-center gap-12 max-lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] max-lg:gap-8 max-md:grid-cols-1 max-md:gap-6"
    >
      <div className="max-md:text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary-500">แนะนำประจำสัปดาห์</p>
        <h1
          id="featured-heading"
          className="mt-3 font-bold leading-[1.15] tracking-tight text-neutral-900"
          style={{ fontSize: "clamp(1.875rem, 1rem + 2.6vw, 3.25rem)" }}
        >
          เรื่องที่นักอ่าน
          <br className="max-md:hidden" />
          <span className="text-primary-500"> ติดงอมแงม</span>สัปดาห์นี้
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-neutral-500 max-md:mx-auto max-md:text-sm">
          คัดจากยอดอ่านจริงของชุมชน BuddyBook — วางเมาส์หรือแตะที่ปกเพื่อดูแต่ละเรื่อง
        </p>
        <div className="mt-8 flex flex-wrap gap-3 max-md:mt-6 max-md:justify-center">
          <Link
            href={startHref}
            className="inline-flex h-12 items-center gap-2 rounded-pill bg-primary-500 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
          >
            <BookOpen className="h-5 w-5" />
            เริ่มอ่าน
          </Link>
          <Link
            href={exploreHref}
            className="inline-flex h-12 items-center gap-2 rounded-pill border border-neutral-300 bg-white px-6 text-base font-medium text-neutral-800 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <Compass className="h-5 w-5" />
            สำรวจนิยาย
          </Link>
        </div>
      </div>

      <ImageAccordion items={items} />
    </section>
  );
}
