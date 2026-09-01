import { PawPrint, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

interface MascotProps {
  className?: string;
  size?: "sm" | "lg";
}

/** ตัวมาสคอตง่าย ๆ ที่คงธีม PawPrint เดียวกับ Logo — ใช้ทั้งหน้า Onboarding และ empty states
 *  (โปรเจกต์นี้ไม่มีไฟล์ภาพประกอบตัวละครจริง จึงประกอบจาก lucide icon ให้เข้าธีมแทน) */
export function Mascot({ className, size = "lg" }: MascotProps) {
  const dimensions = size === "lg" ? "h-24 w-24" : "h-16 w-16";
  const iconSize = size === "lg" ? "h-11 w-11" : "h-7 w-7";

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full bg-brand-tan/15",
        dimensions,
        className
      )}
    >
      <PawPrint className={cn(iconSize, "-rotate-12 text-brand-tan-dark")} fill="currentColor" />
      <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-primary-400" fill="currentColor" />
    </div>
  );
}
