"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Smile, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { STICKERS, findSticker, stickerSrc, type StickerId } from "@/lib/stickers";

/** แสดงสติกเกอร์ในคอมเมนต์/รีวิว — id ที่ไม่รู้จัก (เช่นสติกเกอร์ที่ถูกถอดออกไปแล้ว) จะไม่แสดงอะไร */
export function StickerImage({ id, size = 120, className }: { id: string | null | undefined; size?: number; className?: string }) {
  const sticker = findSticker(id);
  if (!sticker) return null;
  return (
    <Image
      src={stickerSrc(sticker.id)}
      alt={sticker.label}
      title={sticker.label}
      width={size}
      height={size}
      className={cn("select-none", className)}
    />
  );
}

interface StickerPickerProps {
  value: StickerId | null;
  onChange: (id: StickerId | null) => void;
  /** ตำแหน่ง popover เทียบกับปุ่ม */
  align?: "left" | "right";
}

/** ปุ่มหน้ายิ้ม + popover เลือกสติกเกอร์ (เลือกได้ 1 ตัวต่อคอมเมนต์/รีวิว) */
export function StickerPicker({ value, onChange, align = "left" }: StickerPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="เลือกสติกเกอร์"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="leading-none"
      >
        <Smile className={cn("h-6 w-6 hover:text-neutral-600", open || value ? "text-primary-500" : "text-neutral-400")} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="สติกเกอร์"
          className={cn(
            "absolute bottom-full z-20 mb-2 grid w-72 grid-cols-3 gap-2 rounded-card border border-neutral-200 bg-white p-3 shadow-lg",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          {STICKERS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={value === s.id}
              onClick={() => {
                onChange(value === s.id ? null : s.id);
                setOpen(false);
              }}
              className={cn(
                "rounded-lg p-1 transition-colors hover:bg-neutral-100",
                value === s.id && "bg-primary-50 ring-2 ring-primary-400"
              )}
            >
              <StickerImage id={s.id} size={80} className="h-20 w-20" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** พรีวิวสติกเกอร์ที่เลือกไว้ก่อนส่ง พร้อมปุ่มเอาออก */
export function SelectedStickerPreview({ id, onRemove }: { id: StickerId | null; onRemove: () => void }) {
  if (!id) return null;
  return (
    <div className="relative mb-2 inline-block">
      <StickerImage id={id} size={96} className="h-24 w-24" />
      <button
        type="button"
        aria-label="เอาสติกเกอร์ออก"
        onClick={onRemove}
        className="absolute -right-1 -top-1 rounded-full bg-neutral-700 p-0.5 text-white hover:bg-neutral-900"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
