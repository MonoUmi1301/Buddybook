"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { hasInAppHistory } from "@/components/layout/NavigationTracker";

interface BackButtonProps {
  /** ปลายทาง — ถ้า useHistory=false ไปที่นี่เสมอ; ถ้า useHistory=true ใช้เมื่อไม่มีหน้าก่อนหน้าในเว็บนี้ */
  href: string;
  /** ชื่อหน้าที่จะกลับไป เช่น "ผลงานของฉัน" — บอกผู้ใช้ว่ากดแล้วไปไหน */
  label?: string;
  /** หน้าที่เข้ามาได้จากหลายที่ (หน้านิยาย, หน้าอ่าน) ให้ย้อนตามประวัติจริง */
  useHistory?: boolean;
  variant?: "dark" | "light";
  className?: string;
}

const base =
  "inline-flex min-h-[40px] items-center gap-1 rounded-full pl-1.5 pr-3 text-sm font-medium transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400";

/** ปุ่มย้อนกลับมาตรฐานของหน้าย่อยทุกหน้า (หน้าหลักที่เข้าจาก Navbar/เมนูผู้ใช้ไม่ต้องมี)
 *  เดิม router.back() อย่างเดียว — เปิดลิงก์ตรง (จากไลน์, แท็บใหม่) ไม่มีประวัติให้ย้อน กดแล้วไม่เกิดอะไร
 *  หรือหลุดออกจากเว็บ ตอนนี้ย้อนเฉพาะเมื่อมาจากหน้าในเว็บนี้ ไม่งั้นไปที่ href */
export function BackButton({ href, label = "ย้อนกลับ", useHistory = false, variant = "light", className }: BackButtonProps) {
  const router = useRouter();
  const classes = cn(
    base,
    variant === "dark"
      ? "text-zinc-300 hover:bg-white/10 hover:text-white active:bg-white/20"
      : "text-neutral-600 hover:bg-primary-50 hover:text-primary-600 active:bg-primary-100",
    className
  );
  const content = (
    <>
      <ChevronLeft className="h-5 w-5" aria-hidden />
      {label}
    </>
  );

  if (!useHistory) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (hasInAppHistory() ? router.back() : router.push(href))}
      className={classes}
    >
      {content}
    </button>
  );
}
