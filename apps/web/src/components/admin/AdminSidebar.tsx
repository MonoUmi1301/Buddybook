"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ScrollText, Tag, Users, type LucideIcon } from "lucide-react";
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
];

/** แถบเมนูฝั่ง Admin & System Management ดู API_Endpoints.md ส่วนที่ 5 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 rounded-card bg-neutral-100 p-3">
      <nav className="space-y-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
