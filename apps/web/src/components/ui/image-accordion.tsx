"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { useBreakpoint } from "@/hooks/use-breakpoint";

export interface ImageAccordionItem {
  id: string | number;
  title: string;
  /** เช่น ชื่อผู้แต่ง */
  subtitle?: string;
  imageUrl: string;
  href?: string;
  /** เช่น "#1 ยอดวิว" */
  badge?: string;
}

export interface ImageAccordionProps {
  items: ImageAccordionItem[];
  defaultIndex?: number;
  /** ความสูงบนเดสก์ท็อป — แท็บเล็ต/มือถือใช้ค่าในตาราง responsive (ดู class ด้านล่าง) */
  height?: string;
  expandedWidth?: string;
  collapsedWidth?: string;
  onActivate?: (item: ImageAccordionItem) => void;
  className?: string;
}

const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#d4d4d4"/></svg>'
  );

/** เปลี่ยนภายหลัง (perf) — next/image แทน <img> (เดิมโหลดปกต้นฉบับเต็มไฟล์แม้แผงหดเหลือ 72px) ขนาดตาม
 *  แผงที่ขยายสุด 420px (มือถือเต็มความกว้าง) ถ้าโหลดไม่ได้สลับเป็นพื้นเทาเหมือนเดิม */
function AccordionImage({ src }: { src: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed || !src) {
    // eslint-disable-next-line @next/next/no-img-element -- data URI พื้นเทาเฉย ๆ ไม่ต้องผ่าน optimizer
    return <img src={FALLBACK_IMAGE} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />;
  }
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="(max-width: 767px) 100vw, (max-width: 1023px) 300px, 420px"
      draggable={false}
      onError={() => setFailed(true)}
      className="object-cover"
    />
  );
}

/**
 * แผงรูปที่ขยายออกทีละแผง (hero หน้าแรก)
 * - เมาส์: ขยายเมื่อ hover หรือ focus, คลิกแผงที่ขยายอยู่ = เปิด
 * - จอสัมผัส: แตะครั้งแรก = ขยาย, แตะซ้ำ = เปิด (ไม่มีอะไรพึ่ง hover อย่างเดียว)
 * - ต่ำกว่า 768px: เรียงแนวตั้ง (ยืดความสูงแทนความกว้าง) ไม่ล้นจอแนวนอน
 */
export function ImageAccordion({
  items,
  defaultIndex = 0,
  height = "h-[460px]",
  expandedWidth = "w-[420px]",
  collapsedWidth = "w-[72px]",
  onActivate,
  className,
}: ImageAccordionProps) {
  const router = useRouter();
  const { canHover } = useBreakpoint();
  const [active, setActive] = React.useState(Math.min(defaultIndex, Math.max(items.length - 1, 0)));

  if (items.length === 0) return null;

  function open(item: ImageAccordionItem) {
    if (onActivate) onActivate(item);
    else if (item.href) router.push(item.href);
  }

  function onClick(index: number, item: ImageAccordionItem) {
    // จอสัมผัส: แตะแผงที่ยังหุบอยู่ = แค่ขยาย ยังไม่เปิด
    if (!canHover && index !== active) {
      setActive(index);
      return;
    }
    setActive(index);
    open(item);
  }

  return (
    <div
      className={cn(
        "flex w-full items-stretch justify-end gap-3",
        height,
        "max-lg:h-[380px] max-lg:gap-2",
        "max-md:h-auto max-md:flex-col",
        className
      )}
    >
      {items.map((item, index) => {
        const isActive = index === active;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={`${item.title}${item.subtitle ? ` โดย ${item.subtitle}` : ""}`}
            aria-expanded={isActive}
            onMouseEnter={canHover ? () => setActive(index) : undefined}
            onFocus={() => setActive(index)}
            onClick={() => onClick(index, item)}
            className={cn(
              "group relative shrink-0 overflow-hidden rounded-2xl bg-neutral-200 text-left shadow-md",
              "transition-all duration-700 ease-in-out motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2",
              "h-full",
              isActive
                ? cn(expandedWidth, "max-lg:w-[300px] max-md:h-[260px] max-md:w-full")
                : cn(collapsedWidth, "max-lg:w-[56px] max-md:h-[56px] max-md:w-full")
            )}
          >
            <AccordionImage src={item.imageUrl} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {/* ข้อความตอนขยาย */}
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 p-5 text-white transition-opacity duration-500 max-md:p-4",
                isActive ? "opacity-100 delay-200" : "pointer-events-none opacity-0"
              )}
            >
              {item.badge && (
                <span className="mb-2 inline-flex rounded-pill bg-primary-500 px-2.5 py-0.5 text-xs font-semibold shadow">
                  {item.badge}
                </span>
              )}
              <p className="line-clamp-2 text-lg font-bold leading-snug drop-shadow max-md:text-base">{item.title}</p>
              {item.subtitle && <p className="mt-0.5 truncate text-sm text-white/80">{item.subtitle}</p>}
            </div>

            {/* ชื่อเรื่องตอนหุบ — หมุน 90° บนเดสก์ท็อป/แท็บเล็ต, แนวนอนบนมือถือ (แถวเตี้ย) */}
            <span
              aria-hidden
              className={cn(
                "absolute whitespace-nowrap text-sm font-semibold text-white drop-shadow transition-opacity duration-300",
                "bottom-24 left-1/2 w-[280px] origin-center -translate-x-1/2 -rotate-90 truncate text-center",
                "max-lg:bottom-20 max-lg:w-[220px]",
                "max-md:bottom-auto max-md:left-4 max-md:top-1/2 max-md:w-[calc(100%-2rem)] max-md:-translate-x-0 max-md:-translate-y-1/2 max-md:rotate-0 max-md:text-left",
                isActive ? "opacity-0" : "opacity-100"
              )}
            >
              {item.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
