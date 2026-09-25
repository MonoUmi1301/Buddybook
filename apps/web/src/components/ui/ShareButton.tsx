"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface ShareButtonProps {
  title: string;
  className?: string;
  /** แสดงข้อความข้างไอคอน (ไม่ใส่ = ปุ่มไอคอนกลม) */
  label?: string;
}

/** แชร์ลิงก์หน้าปัจจุบัน — ใช้ Web Share API บนมือถือ ถ้าไม่มี (เดสก์ท็อปส่วนใหญ่) คัดลอกลิงก์แทน */
export function ShareButton({ title, className, label }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // ผู้ใช้กดยกเลิก หรือเบราว์เซอร์ปฏิเสธ — ตกไปคัดลอกลิงก์แทน
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard ใช้ไม่ได้ (เช่น http ที่ไม่ใช่ localhost) — ไม่มีทางแชร์ต่อ ปล่อยเงียบไว้
    }
  }

  const Icon = copied ? Check : Share2;

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? "คัดลอกลิงก์แล้ว" : "แชร์"}
      title={copied ? "คัดลอกลิงก์แล้ว" : "แชร์"}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-pill border border-neutral-300 bg-white text-sm font-medium text-neutral-700 transition-colors",
        "hover:border-primary-300 hover:text-primary-600",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
        label ? "px-4" : "w-11",
        copied && "border-emerald-400 text-emerald-600",
        className
      )}
    >
      <Icon className="h-4 w-4" />
      {label && <span>{copied ? "คัดลอกลิงก์แล้ว" : label}</span>}
    </button>
  );
}
