"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

interface BackButtonProps {
  variant?: "dark" | "light";
  className?: string;
}

/** ปุ่มย้อนกลับ — ใช้ history ของเบราว์เซอร์ (router.back()) แทนการ hardcode ปลายทาง
 *  เพราะผู้ใช้อาจเข้าหน้านี้มาจากหลายที่ (หน้ารวมนิยาย, ค้นหา, ชั้นหนังสือ ฯลฯ) */
export function BackButton({ variant = "light", className }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-medium text-primary-500 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
        variant === "dark" ? "hover:bg-white/10 active:bg-white/20" : "hover:bg-primary-50 active:bg-primary-100",
        className
      )}
    >
      <ArrowLeft className="h-5 w-5" />
      ย้อนกลับ
    </button>
  );
}
