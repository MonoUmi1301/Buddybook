"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Flag, Gift, LayoutDashboard, ScrollText, ShieldAlert, Tag, Users, type LucideIcon, Headset, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/cn";

interface AdminTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** จำนวนงานค้างของแต่ละเมนู (key = href) — มาจาก GET /admin/reports/stats ใน admin/layout.tsx */
export type AdminBadges = Partial<Record<string, number>>;

const tabs: AdminTab[] = [
  { href: "/admin", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/admin/sentiment", label: "ความรู้สึกผู้อ่าน", icon: MessagesSquare },
  { href: "/admin/novels", label: "ตรวจสอบนิยาย", icon: ScrollText },
  { href: "/admin/users", label: "ผู้ใช้งาน", icon: Users },
  { href: "/admin/tags", label: "จัดการแท็ก", icon: Tag },
  { href: "/admin/gifts", label: "ของขวัญ", icon: Gift },
  { href: "/admin/gift-reports", label: "การ์ดที่ถูกรายงาน", icon: Flag },
  { href: "/admin/content-reports", label: "รายงานเนื้อหา", icon: ShieldAlert },
  { href: "/admin/withdrawals", label: "คำขอถอนเงิน", icon: Banknote },
  { href: "/admin/support", label: "แจ้งปัญหา", icon: Headset },
];

/** แถบเมนูฝั่ง Admin & System Management ดู API_Endpoints.md ส่วนที่ 5
 *  desktop (>=1024) เป็นเมนูแนวตั้ง, tablet/mobile เป็นแท็บแนวนอนเลื่อนซ้ายขวาได้ (เต็มความกว้าง) */
export function AdminSidebar({ badges = {} }: { badges?: AdminBadges }) {
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
    <aside className="w-56 shrink-0 rounded-card border border-neutral-200 bg-white p-3 max-lg:w-full max-lg:p-1.5">
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
                active ? "bg-primary-500 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{tab.label}</span>
              {!!badges[tab.href] && (
                <span
                  className={cn(
                    "min-w-[1.25rem] rounded-pill px-1.5 text-center text-[11px] font-bold leading-5",
                    active ? "bg-white text-primary-600" : "bg-red-500 text-white"
                  )}
                >
                  {badges[tab.href]! > 99 ? "99+" : badges[tab.href]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
