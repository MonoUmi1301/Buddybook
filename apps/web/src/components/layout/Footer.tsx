"use client";

import Link from "next/link";
import { PawPrint } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/cn";

const columns = [
  {
    title: "เนื้อหา",
    links: [
      { label: "นิยาย", href: "/" },
      { label: "แฟนฟิค", href: "/search?legal_status=fan-fiction" },
    ],
  },
  {
    title: "วิธีการใช้งาน",
    links: [
      { label: "วิธีเติม coin", href: "/wallet" },
      { label: "คู่มือการใช้งาน", href: "/guide" },
      { label: "เงื่อนไขการใช้บริการ", href: "/terms" },
      { label: "นโยบายความเป็นส่วนตัว", href: "/privacy" },
    ],
  },
  {
    title: "เกี่ยวกับเรา",
    links: [
      { label: "ติดต่อเรา", href: "/contact" },
      { label: "ทำความรู้จัก BuddyBook", href: "/about" },
    ],
  },
];

interface FooterProps {
  /** ปกติไม่ต้องส่ง — Footer อ่านธีมปัจจุบันจาก ThemeProvider (global toggle) เอง */
  theme?: "dark" | "light";
}

// ดู footer 3 คอลัมน์ + mascot มุมซ้ายล่างใน wf_home_dark.png / wf_empty_states.png
// (mascot เป็นภาพประกอบวาดมือ ไม่มีไฟล์ asset แยกในโปรเจกต์ — ใช้ไอคอนอุ้งเท้าแทนไปก่อน)
export function Footer({ theme }: FooterProps) {
  const { theme: globalTheme } = useTheme();
  const isDark = (theme ?? globalTheme) === "dark";

  return (
    <footer
      className={cn("border-t", isDark ? "border-surface-border bg-surface-raised" : "border-neutral-200 bg-neutral-50")}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:justify-between lg:px-8">
        <div className={cn(isDark ? "text-brand-tan" : "text-brand-brown")}>
          <PawPrint className="h-10 w-10 shrink-0" fill="currentColor" />
        </div>

        <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-3 lg:max-w-xl">
          {columns.map((col) => (
            <div key={col.title}>
              <p className={cn("mb-3 text-sm font-semibold", isDark ? "text-zinc-100" : "text-neutral-900")}>
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={cn(
                        "text-sm transition-colors hover:text-primary-500",
                        isDark ? "text-zinc-400" : "text-neutral-600"
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "border-t px-4 py-4 text-center text-xs sm:px-6 lg:px-8",
          isDark ? "border-surface-border text-neutral-500" : "border-neutral-200 text-neutral-500"
        )}
      >
        © 2026 BuddyBook.com by Nannapat &amp; Montira — This site is protected by reCAPTCHA and the
        Google Privacy Policy and Terms of Service apply.
      </div>
    </footer>
  );
}
