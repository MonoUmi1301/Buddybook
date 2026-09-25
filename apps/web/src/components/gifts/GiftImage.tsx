"use client";

import { useState } from "react";
import Image from "next/image";
import { GIFT_IMAGE_SIZE, fallbackToMascot, giftImage } from "@/lib/donate-assets";
import { cn } from "@/lib/cn";

interface GiftImageProps {
  slug: string;
  alt: string;
  /** ค่า sizes ของ next/image ตาม breakpoint ที่ใช้จริง */
  sizes: string;
  className?: string;
  /** แถวแรกของ GiftDialog โหลดทันที ที่เหลือ lazy */
  eager?: boolean;
}

/** รูปของขวัญ (PNG 512x512) — ถ้าไฟล์หาย สลับเป็นมาสคอตหมีและเตือนใน console ตอน dev */
export function GiftImage({ slug, alt, sizes, className, eager }: GiftImageProps) {
  const [src, setSrc] = useState(() => giftImage(slug));

  return (
    <Image
      src={src}
      alt={alt}
      width={GIFT_IMAGE_SIZE}
      height={GIFT_IMAGE_SIZE}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      draggable={false}
      className={cn("h-full w-full select-none object-contain", className)}
      onError={() => setSrc((current) => (current === giftImage(slug) ? fallbackToMascot(slug) : current))}
    />
  );
}
