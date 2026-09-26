"use client";

import * as React from "react";
import Image from "next/image";
import { CAROUSEL_COVER_SIZES } from "@/lib/library";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/** ระยะลากสูงสุด (px) ที่ยังนับเป็น "แตะ" ไม่ใช่ "ลาก" */
const TAP_SLOP = 6;

export interface CoverflowSlide {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  meta?: { label: string; value: string }[];
}

export interface CoverflowCarouselProps<T extends CoverflowSlide = CoverflowSlide> {
  slides: T[];
  rotate?: number;
  depth?: number;
  perspective?: number;
  falloff?: number;
  fade?: number;
  cardWidth?: string;
  /** กว้าง/สูงของการ์ด — ปกนิยายใช้ 2/3 */
  aspectRatio?: number;
  gap?: number;
  loop?: boolean;
  showCaption?: boolean;
  showPagination?: boolean;
  showNavigation?: boolean;
  /** ms — เลื่อนอัตโนมัติ หยุดตอน hover / focus / ลาก / แท็บถูกซ่อน */
  autoplay?: number;
  label?: string;
  className?: string;
  cardClassName?: string;
  /** แตะ/คลิกการ์ดตรงกลาง หรือกด Enter */
  onActivate?: (index: number) => void;
  onSelectChange?: (index: number) => void;
  /** แทน <img> ปกติ (เช่น ใส่แถบความคืบหน้า/ป้ายอันดับบนปก) */
  renderCard?: (slide: T, index: number, isActive: boolean) => React.ReactNode;
  /** แสดงใต้ caption (เช่น ปุ่ม "อ่านต่อ") */
  captionExtra?: React.ReactNode;
  /** ย่อ meta เหลือบรรทัดเดียว (มือถือ) */
  compactCaption?: boolean;
  /** เช่น "hidden max-xl:flex" — ซ่อน caption บนจอกว้างเมื่อมีแผงข้างแสดงแทน */
  captionClassName?: string;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function CoverflowCarousel<T extends CoverflowSlide = CoverflowSlide>({
  slides,
  rotate = 44,
  depth = 0.6,
  perspective = 3,
  falloff = 0.56,
  fade = 0.1,
  cardWidth = "clamp(148px, 22vw, 260px)",
  aspectRatio = 1,
  gap = 0.05,
  loop = true,
  showCaption = false,
  showPagination = false,
  showNavigation = false,
  autoplay,
  label = "Cover carousel",
  className,
  cardClassName,
  onActivate,
  onSelectChange,
  renderCard,
  captionExtra,
  compactCaption = false,
  captionClassName,
}: CoverflowCarouselProps<T>) {
  const count = slides.length;
  const reducedMotion = usePrefersReducedMotion();

  const frameRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const posRef = React.useRef(0);
  const targetRef = React.useRef(0);
  const widthRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const dragRef = React.useRef<{ id: number; x: number; startX: number; pos: number; v: number; t: number } | null>(
    null
  );
  // offscreen: คารูเซลเลื่อนพ้นจอแล้ว — autoplay หยุด ไม่วาดแอนิเมชันที่ไม่มีใครเห็น (ดู IntersectionObserver ด้านล่าง)
  const pausedRef = React.useRef({ hover: false, focus: false, drag: false, offscreen: false });

  // เปลี่ยนภายหลัง (perf) — will-change เฉพาะตอนกำลังขยับ (เดิมติดทุกการ์ดตลอดเวลา = ทุกใบเป็น compositor
  // layer ค้างไว้ กินหน่วยความจำ GPU แม้คารูเซลนิ่ง)
  const setAnimating = React.useCallback((on: boolean) => {
    cardRefs.current.forEach((card) => {
      if (card) card.style.willChange = on ? "transform" : "";
    });
  }, []);

  const [selected, setSelected] = React.useState(0);

  const indexAt = React.useCallback((pos: number) => ((Math.round(pos) % count) + count) % count, [count]);

  const paint = React.useCallback(() => {
    const width = widthRef.current;
    if (!width) return;
    const pitch = width * (1 + gap);
    const pos = posRef.current;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;

      let offset = index - pos;
      if (loop) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }

      const distance = Math.abs(offset);
      const ramp = Math.pow(distance, falloff);
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);

      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`;

      const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
      const opacity = Math.max(0, 1 - fade * distance) * edge;
      card.style.opacity = String(opacity);
      card.style.zIndex = String(100 - Math.round(distance));
      // การ์ดที่มองไม่เห็นแล้วต้องไม่รับคลิก/โฟกัส
      card.style.pointerEvents = opacity < 0.05 ? "none" : "auto";
    });
  }, [count, depth, fade, falloff, gap, loop, rotate]);

  const settle = React.useCallback(
    (target: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      targetRef.current = target;
      setSelected(indexAt(target));

      if (reducedMotion) {
        posRef.current = target;
        paint();
        rafRef.current = null;
        setAnimating(false);
        return;
      }

      setAnimating(true);
      const step = () => {
        const remaining = target - posRef.current;
        if (Math.abs(remaining) < 0.0004) {
          posRef.current = target;
          paint();
          rafRef.current = null;
          setAnimating(false);
          return;
        }
        posRef.current += remaining * 0.16;
        paint();
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [indexAt, paint, reducedMotion, setAnimating]
  );

  const clamp = React.useCallback((pos: number) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))), [count, loop]);

  const goTo = React.useCallback(
    (index: number) => {
      const target = loop ? index + Math.round((targetRef.current - index) / count) * count : index;
      settle(clamp(target));
    },
    [clamp, count, loop, settle]
  );

  const nudge = React.useCallback((by: number) => settle(clamp(Math.round(targetRef.current) + by)), [clamp, settle]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    targetRef.current = posRef.current;
    pausedRef.current.drag = true;
    setAnimating(true);
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      startX: event.clientX,
      pos: posRef.current,
      v: 0,
      t: performance.now(),
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;

    const pitch = widthRef.current * (1 + gap);
    if (!pitch) return;

    const now = performance.now();
    const previous = posRef.current;
    posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch);
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000;
    drag.t = now;

    const index = indexAt(posRef.current);
    if (index !== selected) setSelected(index);
    paint();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    pausedRef.current.drag = false;

    // แตะ (ขยับไม่ถึง TAP_SLOP) — การ์ดกลาง = เปิด, การ์ดข้าง = เลื่อนไปหา
    // pointer capture ทำให้ event.target เป็น frame เสมอ จึงต้องหา element ใต้นิ้วจากพิกัดเอง
    if (event.type === "pointerup" && Math.abs(event.clientX - drag.startX) < TAP_SLOP) {
      const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-cf-index]");
      posRef.current = drag.pos;
      if (hit) {
        const index = Number(hit.dataset.cfIndex);
        if (index === indexAt(targetRef.current)) {
          settle(targetRef.current);
          onActivate?.(index);
        } else {
          goTo(index);
        }
        return;
      }
      settle(clamp(Math.round(posRef.current)));
      return;
    }

    const carried = Math.max(-2, Math.min(2, drag.v * 0.18));
    settle(clamp(Math.round(posRef.current + carried)));
  };

  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const card = cardRefs.current[0];
      if (!card) return;
      widthRef.current = card.offsetWidth;
      paint();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [paint, count]);

  React.useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  React.useEffect(() => {
    onSelectChange?.(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- แจ้งเฉพาะตอน selected เปลี่ยน
  }, [selected]);

  // เพิ่มภายหลัง (perf) — หยุด autoplay เมื่อคารูเซลอยู่นอกจอ (หน้าแรกมีหลายตัว เลื่อนลงไปแล้วตัวบนยังหมุนวาดเฟรมอยู่)
  React.useEffect(() => {
    const frame = frameRef.current;
    if (!autoplay || !frame || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      pausedRef.current.offscreen = !entry.isIntersecting;
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [autoplay]);

  // autoplay — ไม่ขยับถ้าผู้ใช้กำลังดู/ใช้อยู่ หรือแท็บถูกซ่อน หรือขอลดการเคลื่อนไหว
  React.useEffect(() => {
    if (!autoplay || count < 2 || reducedMotion) return;
    const timer = window.setInterval(() => {
      const p = pausedRef.current;
      if (p.hover || p.focus || p.drag || p.offscreen || document.hidden) return;
      nudge(1);
    }, autoplay);
    return () => window.clearInterval(timer);
  }, [autoplay, count, nudge, reducedMotion]);

  if (count === 0) return null;

  const active = slides[selected];

  return (
    <div
      className={cn("w-full", className)}
      style={{ ["--cf-card" as string]: cardWidth }}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => (pausedRef.current.hover = true)}
      onMouseLeave={() => (pausedRef.current.hover = false)}
      onFocus={() => (pausedRef.current.focus = true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) pausedRef.current.focus = false;
      }}
    >
      <div className="relative">
        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              nudge(-1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              nudge(1);
            } else if (event.key === "Enter") {
              event.preventDefault();
              onActivate?.(selected);
            }
          }}
          className="cursor-grab overflow-hidden rounded-card py-10 outline-none ring-primary-400 focus-visible:ring-2 active:cursor-grabbing"
          style={{ perspective: `calc(var(--cf-card) * ${perspective})`, touchAction: "pan-y" }}
        >
          <div
            className="relative select-none"
            style={{ height: `calc(var(--cf-card) / ${aspectRatio})`, transformStyle: "preserve-3d" }}
          >
            {slides.map((slide, index) => (
              <div
                key={index}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                data-cf-index={index}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} จาก ${count}${slide.title ? ` — ${slide.title}` : ""}`}
                aria-current={index === selected ? "true" : undefined}
                className={cn(
                  "absolute left-1/2 top-0 overflow-hidden rounded-2xl bg-neutral-100 shadow-xl",
                  cardClassName
                )}
                style={{ width: "var(--cf-card)", aspectRatio }}
              >
                {renderCard ? (
                  renderCard(slide, index, index === selected)
                ) : (
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    width={400}
                    height={600}
                    sizes={CAROUSEL_COVER_SIZES}
                    draggable={false}
                    className="h-full w-full select-none object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {showNavigation && count > 1 && (
          <>
            <button
              type="button"
              aria-label="เรื่องก่อนหน้า"
              onClick={() => nudge(-1)}
              className="absolute left-3 top-1/2 z-[200] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-800 shadow-md backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="เรื่องถัดไป"
              onClick={() => nudge(1)}
              className="absolute right-3 top-1/2 z-[200] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-800 shadow-md backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {showCaption && active?.title && (
        <div
          key={selected}
          className={cn("flex flex-col items-center px-6 text-center duration-300 animate-in fade-in", captionClassName)}
          aria-live="polite"
        >
          <p className="line-clamp-2 text-base font-semibold tracking-tight text-neutral-900">{active.title}</p>
          {active.subtitle && <p className="mt-1 text-sm text-neutral-500">{active.subtitle}</p>}
          {active.meta && active.meta.length > 0 &&
            (compactCaption ? (
              <p className="mt-2 text-xs text-neutral-500">
                {active.meta.map((row) => `${row.label} ${row.value}`).join(" · ")}
              </p>
            ) : (
              <dl className="mt-4 w-full max-w-[260px] text-xs">
                {active.meta.map((row) => (
                  <div key={row.label} className="flex justify-between border-b border-neutral-100 py-1.5 last:border-0">
                    <dt className="text-neutral-500">{row.label}</dt>
                    <dd className="font-medium text-neutral-900">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ))}
          {captionExtra && <div className="mt-4 w-full max-w-[260px] max-md:max-w-none">{captionExtra}</div>}
        </div>
      )}

      {showPagination && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`ไปเรื่องที่ ${index + 1}`}
              aria-current={index === selected}
              onClick={() => goTo(index)}
              className={cn("h-2 w-2 rounded-full bg-neutral-900 transition-opacity", index === selected ? "opacity-100" : "opacity-30")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
