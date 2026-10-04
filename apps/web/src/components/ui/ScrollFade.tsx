"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ScrollFadeProps {
  children: ReactNode;
  /** คลาสของกรอบนอก (เช่น ขอบ/มุมโค้ง) — เงาถูกตัดตามกรอบนี้ */
  className?: string;
}

/**
 * กล่องเลื่อนแนวนอนที่มีเงาจางตรงขอบฝั่งที่ยังเลื่อนไปได้ — ให้รู้ว่ามีเนื้อหาซ่อนอยู่ (เช่น ตารางบนมือถือ)
 * เงาซ้าย/ขวาโผล่เฉพาะตอนเลื่อนไปทางนั้นได้จริง อัปเดตตอนเลื่อนและตอนขนาดกล่องเปลี่ยน
 * สีเงาอ้าง --color-surface-card ตรง ๆ (สีเดียวกับ bg-white ที่สลับตามธีม) — ใช้ from-white ไม่ได้
 * เพราะ Tailwind คอมไพล์ gradient ของ white เป็น #fff ตายตัว ในโหมดมืดเลยกลายเป็นแถบขาว
 */
const fadeTo = (side: "right" | "left") =>
  `linear-gradient(to ${side}, rgb(var(--color-surface-card)), rgb(var(--color-surface-card) / 0))`;

export function ScrollFade({ children, className }: ScrollFadeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-10 transition-opacity duration-200",
          edges.left ? "opacity-100" : "opacity-0"
        )}
        style={{ backgroundImage: fadeTo("right") }}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 transition-opacity duration-200",
          edges.right ? "opacity-100" : "opacity-0"
        )}
        style={{ backgroundImage: fadeTo("left") }}
      />
    </div>
  );
}
