"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  Coins,
  History,
  LogOut,
  Moon,
  PenSquare,
  Settings,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useTheme } from "@/components/theme/ThemeProvider";

interface UserMenuUser {
  userId: string;
  username: string;
  email: string;
  avatarUrl?: string;
}

interface UserMenuProps {
  user: UserMenuUser;
  theme?: "dark" | "light";
}

// เมนูโปรไฟล์แบบ dropdown — รายการอ้างอิงจาก wireframe (ธีม/ชั้นหนังสือ/สร้างผลงาน/
// ประวัติการซื้อ/เติม coin/ออกจากระบบ) เปิด-ปิดด้วย state จริง + ปิดเมื่อคลิกนอกเมนู
export function UserMenu({ user, theme = "dark" }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isDark = theme === "dark";
  const router = useRouter();
  const { toggleTheme } = useTheme();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const menuItems: { icon: typeof Moon; label: string; href?: string; onClick?: () => void }[] = [
    { icon: Moon, label: "ธีม", onClick: toggleTheme },
    { icon: BookMarked, label: "ชั้นหนังสือ", href: "/library" },
    { icon: PenSquare, label: "สร้างผลงาน", href: "/write" },
    { icon: History, label: "ประวัติการซื้อ", href: "/wallet" },
    { icon: Coins, label: "เติม coin", href: "/wallet" },
    { icon: Settings, label: "ตั้งค่าบัญชี", href: "/settings" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <Avatar src={user.avatarUrl} alt={user.username} size="md" />
      </button>

      <div
        role="menu"
        className={cn(
          "absolute right-0 top-12 z-50 w-64 origin-top-right rounded-card border py-2 shadow-xl transition-all duration-150",
          isDark ? "border-surface-border bg-surface-raised" : "border-neutral-200 bg-white",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        )}
      >
        <Link
          href={`/profile/${user.userId}`}
          role="menuitem"
          className={cn(
            "flex items-center gap-3 border-b px-4 pb-3 pt-1 transition-colors",
            isDark ? "border-surface-border hover:bg-white/5" : "border-neutral-200 hover:bg-neutral-100"
          )}
        >
          <Avatar src={user.avatarUrl} alt={user.username} size="md" />
          <div className="min-w-0">
            <p className={cn("truncate text-sm font-medium", isDark ? "text-zinc-100" : "text-neutral-900")}>
              {user.username}
            </p>
            <p className={cn("truncate text-xs", isDark ? "text-zinc-400" : "text-neutral-500")}>{user.email}</p>
          </div>
        </Link>

        <ul className="py-1">
          {menuItems.map(({ icon: Icon, label, href, onClick }) => (
            <li key={label}>
              {onClick ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={onClick}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
                    isDark ? "text-zinc-200 hover:bg-white/5" : "text-neutral-700 hover:bg-neutral-100"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isDark ? "text-zinc-400" : "text-neutral-400")} />
                  {label}
                </button>
              ) : (
                <Link
                  href={href ?? "#"}
                  role="menuitem"
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                    isDark ? "text-zinc-200 hover:bg-white/5" : "text-neutral-700 hover:bg-neutral-100"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isDark ? "text-zinc-400" : "text-neutral-400")} />
                  {label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className={cn("border-t pt-1", isDark ? "border-surface-border" : "border-neutral-200")}>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
          </button>
        </div>
      </div>
    </div>
  );
}
