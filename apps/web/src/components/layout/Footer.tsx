"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, PenLine } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/cn";

// ทุกลิงก์ชี้ไปหน้าที่มีอยู่จริงและมีเนื้อหา (ไม่มี href="#")
const columns = [
  {
    title: "อ่านนิยาย",
    links: [
      { label: "นิยาย", href: "/" },
      { label: "แฟนฟิค", href: "/search?legal_status=fan-fiction" },
      { label: "ค้นหานิยาย", href: "/search" },
      { label: "ชั้นหนังสือของฉัน", href: "/library" },
    ],
  },
  {
    title: "นักเขียน",
    links: [
      { label: "เริ่มเขียนนิยาย", href: "/write" },
      { label: "ผลงานของฉัน", href: "/write" },
      { label: "สถิติผลงาน", href: "/write/stats" },
    ],
  },
  {
    title: "วิธีการใช้งาน",
    links: [
      { label: "คู่มือการใช้งาน", href: "/guide" },
      { label: "วิธีเติม coin", href: "/guide/coin" },
      { label: "คำถามที่พบบ่อย", href: "/faq" },
    ],
  },
  {
    title: "บัญชี",
    links: [
      { label: "เข้าสู่ระบบ", href: "/login" },
      { label: "สมัครสมาชิก", href: "/register" },
      { label: "เติม coin", href: "/wallet" },
      { label: "ตั้งค่าบัญชี", href: "/settings" },
    ],
  },
  {
    title: "เกี่ยวกับเรา",
    links: [
      { label: "ทำความรู้จัก BuddyBook", href: "/about" },
      { label: "ติดต่อเรา", href: "/contact" },
      { label: "แจ้งปัญหาการใช้งาน", href: "/support#ticket" },
    ],
  },
];

// ลายอุ้งเท้าหมีโปร่ง ๆ ปูพื้นหลัง (SVG inline — ไม่ต้องมีไฟล์รูป)
const pawPattern = (color: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><g fill='${color}'>` +
      `<g transform='translate(18 20) rotate(-18)'><ellipse cx='0' cy='6' rx='7' ry='6'/><circle cx='-7' cy='-4' r='2.6'/><circle cx='-2.5' cy='-7.5' r='2.6'/><circle cx='2.5' cy='-7.5' r='2.6'/><circle cx='7' cy='-4' r='2.6'/></g>` +
      `<g transform='translate(66 66) rotate(16)'><ellipse cx='0' cy='6' rx='7' ry='6'/><circle cx='-7' cy='-4' r='2.6'/><circle cx='-2.5' cy='-7.5' r='2.6'/><circle cx='2.5' cy='-7.5' r='2.6'/><circle cx='7' cy='-4' r='2.6'/></g>` +
      `</g></svg>`
  )}")`;

interface FooterProps {
  /** ปกติไม่ต้องส่ง — Footer อ่านธีมปัจจุบันจาก ThemeProvider (global toggle) เอง */
  theme?: "dark" | "light";
}

/** Footer โทนส้มอบอุ่น + ลายอุ้งเท้า + เนินเขามีน้องหมีโผล่ (แรงบันดาลใจจาก footer แบบ "Take your weekends back")
 *  จอใหญ่: หัวข้อใหญ่ซ้าย ลิงก์หลายคอลัมน์ขวา / มือถือ: เรียงแถวเดียว ภาพประกอบอยู่ล่างสุด */
export function Footer({ theme }: FooterProps) {
  const { theme: globalTheme } = useTheme();
  const isDark = (theme ?? globalTheme) === "dark";

  return (
    <footer
      className={cn("relative overflow-hidden", isDark ? "bg-[#211A15] text-zinc-200" : "bg-[#FFEBD6] text-brand-brown")}
      style={{ backgroundImage: pawPattern(isDark ? "rgba(240,128,60,0.07)" : "rgba(240,128,60,0.13)") }}
    >
      <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8 lg:pt-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          {/* ---- หัวข้อใหญ่ + ปุ่ม ---- */}
          <div className="max-lg:text-center">
            <Logo variant={isDark ? "dark" : "light"} />
            <p
              className={cn(
                "mt-5 text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl",
                isDark ? "text-brand-tan" : "text-brand-brown"
              )}
            >
              อ่านให้สนุก
              <br />
              เขียนให้สุด
            </p>
            <p className={cn("mt-3 text-sm", isDark ? "text-zinc-400" : "text-brand-brown-light")}>
              เรื่องที่เหลือ ให้น้องหมีดูแลเอง 🐾
            </p>
            <div className="mt-6 flex flex-wrap gap-3 max-lg:justify-center">
              <Link
                href="/search"
                className="inline-flex h-11 items-center gap-2 rounded-pill bg-primary-500 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
              >
                <BookOpen className="h-4 w-4" /> เริ่มอ่านนิยาย
              </Link>
              <Link
                href="/write"
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-pill border-2 px-5 text-sm font-semibold transition-colors",
                  isDark
                    ? "border-primary-400 text-primary-300 hover:bg-primary-500/10"
                    : "border-primary-500 bg-white/60 text-primary-600 hover:bg-white"
                )}
              >
                <PenLine className="h-4 w-4" /> เริ่มเขียนนิยาย
              </Link>
            </div>
          </div>

          {/* ---- ลิงก์ ---- */}
          <nav aria-label="ลิงก์ท้ายเว็บ" className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="mb-3 text-sm font-semibold text-primary-600 dark:text-primary-400">{col.title}</p>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className={cn(
                          "text-sm transition-colors hover:text-primary-600 hover:underline",
                          isDark ? "text-zinc-300" : "text-brand-brown"
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* ---- ภาพประกอบ: เนินเขา + น้องหมีโผล่ + กองหนังสือ ---- */}
      <div className="relative mt-10 h-40 sm:h-48" aria-hidden>
        {/* พระอาทิตย์ */}
        <div
          className={cn(
            "absolute bottom-16 left-[18%] h-24 w-24 rounded-full blur-[1px] sm:h-32 sm:w-32",
            isDark ? "bg-primary-500/25" : "bg-[#FFD9A8]"
          )}
        />
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-full w-full">
          <path
            d="M0 120 C 200 60, 380 70, 560 110 S 900 170, 1100 100 S 1340 50, 1440 80 L1440 200 L0 200 Z"
            fill={isDark ? "#3a2618" : "#FBC08F"}
          />
          <path
            d="M0 150 C 240 110, 460 120, 700 150 S 1120 190, 1440 130 L1440 200 L0 200 Z"
            fill={isDark ? "#4a2e1a" : "#F79A54"}
          />
          <path d="M0 175 C 300 150, 600 160, 900 178 S 1300 185, 1440 165 L1440 200 L0 200 Z" fill={isDark ? "#5B3A29" : "#DB6B28"} />
        </svg>
        {/* กองหนังสือ + น้องหมี วางทับบนเนิน (อยู่หน้า SVG ไม่ให้เนินบัง) */}
        <div className="absolute bottom-[22%] left-[14%] z-10 flex flex-col items-center sm:left-[18%]">
          <span className="h-3 w-14 rounded-sm border-2 border-brand-brown bg-brand-tan sm:w-16" />
          <span className="-mt-0.5 h-3 w-12 rounded-sm border-2 border-brand-brown bg-[#FFF4EC] sm:w-14" />
          <span className="-mt-0.5 h-3 w-16 rounded-sm bg-brand-brown sm:w-[4.5rem]" />
        </div>
        <Image
          src="/donate/mascot/mascot-bear.png"
          alt=""
          width={160}
          height={160}
          className="absolute bottom-[18%] right-[8%] z-10 h-24 w-24 -rotate-6 drop-shadow-md sm:right-[12%] sm:h-32 sm:w-32"
        />
      </div>

      {/* ---- แถบล่าง ---- */}
      <div className={cn("relative", isDark ? "bg-[#5B3A29]" : "bg-[#DB6B28]")}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-xs text-white/90 sm:px-6 lg:px-8">
          <p>© 2026 BuddyBook · พัฒนาโดย Nannapat &amp; Montira</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/terms" className="hover:text-white hover:underline">
              เงื่อนไขการใช้บริการ
            </Link>
            <Link href="/privacy" className="hover:text-white hover:underline">
              นโยบายความเป็นส่วนตัว
            </Link>
            <Link href="/contact" className="hover:text-white hover:underline">
              ติดต่อเรา
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
