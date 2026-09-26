"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Flag, Gift, LayoutDashboard, ScrollText, ShieldAlert, Tag, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface AdminTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const tabs: AdminTab[] = [
  { href: "/admin", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/admin/novels", label: "นิยายรอตรวจสอบ", icon: ScrollText },
  { href: "/admin/users", label: "ผู้ใช้งาน", icon: Users },
  { href: "/admin/tags", label: "จัดการแท็ก", icon: Tag },
  { href: "/admin/gifts", label: "ของขวัญ", icon: Gift },
  { href: "/admin/gift-reports", label: "การ์ดที่ถูกรายงาน", icon: Flag },
  { href: "/admin/content-reports", label: "รายงานเนื้อหา", icon: ShieldAlert },
  { href: "/admin/withdrawals", label: "คำขอถอนเงิน", icon: Banknote },
];

/** แถบเมนูฝั่ง Admin & System Management ดู API_Endpoints.md ส่วนที่ 5
 *  desktop (>=1024) เป็นเมนูแนวตั้ง, tablet/mobile เป็นแท็บแนวนอนเลื่อนซ้ายขวาได้ (เต็มความกว้าง) */
export function AdminSidebar() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // tablet/mobile เป็นแท็บแนวนอนที่เลื่อนได้ — เลื่อนให้แท็บที่เปิดอยู่มองเห็นเสมอ (desktop ไม่ล้นเลยไม่ทำอะไร)
  useEffect(() => {
    const link = activeRef.current;
    const nav = link?.parentElement;
    if (!link || !nav || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
  }, [pathname]);

  return (
    <aside className="w-56 shrink-0 rounded-card bg-neutral-100 p-3 max-lg:w-full max-lg:p-1.5">
      <nav aria-label="เมนูแอดมิน" className="space-y-1 max-lg:flex max-lg:gap-1 max-lg:space-y-0 max-lg:overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              ref={active ? activeRef : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors max-lg:shrink-0 max-lg:whitespace-nowrap",
                active ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-600 hover:bg-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
