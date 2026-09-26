import Image from "next/image";
import { User } from "lucide-react";
import { cn } from "@/lib/cn";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** แสดงตัวอักษรแรกของ alt แทนไอคอนคนเมื่อไม่มีรูป */
  initialFallback?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "aspect-square w-20 md:w-24",
};

const imageSizes = { sm: "32px", md: "40px", lg: "56px", xl: "(min-width: 768px) 96px, 80px" };

const initialTextClasses = { sm: "text-xs", md: "text-sm", lg: "text-lg", xl: "text-2xl md:text-3xl" };

/** ตัวอักษรแรกของชื่อ — ข้ามสระหน้า (เ แ โ ใ ไ) ของภาษาไทย ให้ "เกะโท" ได้ "ก" ไม่ใช่ "เ" */
function initialOf(name: string) {
  const chars = Array.from(name.trim().replace(/^[เ-ไ]+/, ""));
  return (chars[0] ?? "?").toUpperCase();
}

export function Avatar({ src, alt, size = "md", initialFallback = false, className }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tan/30",
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={imageSizes[size]} className="object-cover" />
      ) : initialFallback ? (
        <span
          role="img"
          aria-label={alt}
          className={cn("select-none font-semibold text-brand-brown dark:text-brand-tan", initialTextClasses[size])}
        >
          {initialOf(alt)}
        </span>
      ) : (
        <User className="h-1/2 w-1/2 text-brand-tan-dark" />
      )}
    </div>
  );
}
