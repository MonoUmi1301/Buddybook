"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface QuickAddPopoverProps {
  placeholder: string;
  onSubmit: (value: string) => void;
  children: (open: () => void) => ReactNode;
}

/** ป๊อปอัพเล็ก ๆ สำหรับกรอกชื่อก่อนเพิ่มตัวละคร/สถานที่/เหตุการณ์ — ใช้แทน window.prompt()
 *  เพราะ prompt() บล็อก main thread ของหน้าเว็บทั้งหน้า และใช้งานไม่ได้เลยในหลาย
 *  embedded webview/iframe context (พบตอนทดสอบจริงว่าหน้าค้างสนิทหลังเรียก prompt()) */
export function QuickAddPopover({ placeholder, onSubmit, children }: QuickAddPopoverProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
    setOpen(false);
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      {children(() => setOpen(true))}
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 flex w-56 items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={placeholder}
            className="h-8 flex-1 rounded-md border border-neutral-200 px-2 text-sm text-neutral-900 focus:border-primary-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            className="flex h-8 shrink-0 items-center justify-center rounded-md bg-primary-500 px-2.5 text-xs font-medium text-white hover:bg-primary-600"
          >
            เพิ่ม
          </button>
        </div>
      )}
    </div>
  );
}
