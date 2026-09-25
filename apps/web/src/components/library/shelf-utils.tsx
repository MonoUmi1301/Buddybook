"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** hash คงที่จาก string (FNV-1a) — ใช้กำหนดสี/ขนาดสันหนังสือให้เหมือนเดิมทุกครั้งที่ render */
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** ปิดเมนู/ป็อปโอเวอร์เมื่อคลิกข้างนอกหรือกด Escape */
export function useDismiss<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** มือถือ = bottom sheet, จอใหญ่ = กล่องกลางจอ */
  className?: string;
}

/** โมดัลเบา ๆ (ไม่มี dependency เพิ่ม) — โฟกัสกล่องตอนเปิด, Escape/คลิกฉากหลังเพื่อปิด, ล็อกสกรอลหน้า */
export function Dialog({ open, title, onClose, children, className }: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 max-md:items-end max-md:p-0">
      <div className="absolute inset-0 bg-black/45 duration-200 animate-in fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl outline-none duration-200 animate-in fade-in zoom-in-95",
          "max-md:max-w-none max-md:rounded-b-none max-md:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-md:slide-in-from-bottom-8 max-md:zoom-in-100",
          className
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-neutral-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
