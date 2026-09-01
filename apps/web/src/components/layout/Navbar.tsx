"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Library, PenLine, Search } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/api/session";
import { WORK_TYPE_COOKIE, asWorkType, type WorkType } from "@/lib/workType";

const modeButtons: { label: string; value: WorkType }[] = [
  { label: "นิยาย", value: "original" },
  { label: "แฟนฟิค", value: "fan-fiction" },
];

function readWorkTypeCookie(): WorkType | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${WORK_TYPE_COOKIE}=([^;]*)`));
  return asWorkType(match ? decodeURIComponent(match[1]) : undefined);
}

interface NavbarProps {
  /** ปกติไม่ต้องส่ง — Navbar อ่านธีมปัจจุบันจาก ThemeProvider (global toggle) เอง
   *  ใส่ค่านี้เฉพาะตอนต้องการบังคับธีมค่าใดค่าหนึ่งโดยไม่สนใจธีม global (ไม่มีจุดใช้งานตอนนี้) */
  theme?: "dark" | "light";
  /** ส่งมาจาก Server Component ที่ await getCurrentUser() แล้ว (Navbar เองอ่าน cookie ตรง ๆ ไม่ได้
   *  ถ้าหน้าเป็น Client Component เช่น wallet/page.tsx — เว้นว่างไว้ = แสดงสถานะ guest) */
  user?: SessionUser | null;
}

const iconLinkClasses = (isDark: boolean) =>
  cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150",
    isDark ? "text-zinc-100 hover:bg-white/10" : "text-brand-brown hover:bg-neutral-100"
  );

export function Navbar({ theme, user = null }: NavbarProps) {
  const { theme: globalTheme } = useTheme();
  const effectiveTheme = theme ?? globalTheme;
  const isDark = effectiveTheme === "dark";
  const pathname = usePathname();
  const router = useRouter();
  // เพิ่มภายหลัง (BRIEF: Navbar Global Mode) — "นิยาย"/"แฟนฟิค" ไม่ใช่ลิงก์ค้นหาอีกต่อไป แต่เป็น
  // ตัวสลับโหมดเนื้อหาทั้งเว็บ (หน้าแรกก็ต้องสลับด้วย ไม่ใช่แค่หน้า /search) — ต้องใช้ cookie เก็บ
  // สถานะเพราะหน้าแรก (app/page.tsx) เป็น Server Component อ่าน React state/localStorage ไม่ได้
  // อ่านค่าเริ่มต้นผ่าน useEffect (ไม่ใช่ระหว่าง render) กัน hydration mismatch เพราะ document.cookie
  // มีให้ใช้เฉพาะฝั่ง client เท่านั้น
  const [activeWorkType, setActiveWorkType] = useState<WorkType | undefined>(undefined);
  useEffect(() => {
    setActiveWorkType(readWorkTypeCookie());
  }, [pathname]);

  function selectWorkType(value: WorkType) {
    document.cookie = `${WORK_TYPE_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setActiveWorkType(value); // อัปเดตไฮไลต์ทันที ไม่ต้องรอ navigation/remount
    if (pathname === "/") router.refresh();
    else router.push("/");
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur",
        isDark ? "border-surface-border bg-surface/95" : "border-neutral-200 bg-white/95"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/">
            <Logo variant={effectiveTheme} />
          </Link>
          <nav className="hidden items-center gap-2 sm:flex">
            {modeButtons.map((mode) => {
              const isActive = activeWorkType === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => selectWorkType(mode.value)}
                  className={cn(
                    "rounded-pill px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? isDark
                        ? "bg-white/15 text-white font-semibold"
                        : "bg-primary-50 text-primary-600 font-semibold"
                      : isDark
                        ? "text-zinc-300 hover:text-white"
                        : "text-neutral-600 hover:text-brand-brown"
                  )}
                >
                  {mode.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <Link href="/write" aria-label="สร้างผลงาน" className={iconLinkClasses(isDark)}>
            <PenLine className="h-5 w-5" />
          </Link>
          <Link href="/search" aria-label="ค้นหา" className={iconLinkClasses(isDark)}>
            <Search className="h-5 w-5" />
          </Link>
          <Link href="/library" aria-label="ชั้นหนังสือ" className={iconLinkClasses(isDark)}>
            <Library className="h-5 w-5" />
          </Link>

          {user ? (
            <>
              <NotificationPanel theme={effectiveTheme} />
              <div className="ml-1.5">
                <UserMenu
                  user={{
                    userId: user.user_id,
                    username: user.username,
                    email: user.email,
                    avatarUrl: user.avatar_url ?? undefined,
                  }}
                  theme={effectiveTheme}
                />
              </div>
            </>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <Link
                href="/login"
                className={cn(
                  "text-sm font-medium transition-colors",
                  isDark ? "text-zinc-200 hover:text-white" : "text-neutral-700 hover:text-brand-brown"
                )}
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center rounded-pill bg-primary-500 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-600"
              >
                สมัครสมาชิก
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
