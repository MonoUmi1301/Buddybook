"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Sparkles, UserRound, ScrollText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface Tab {
  key: string;
  label: string;
  icon: LucideIcon;
}

const tabs: Tab[] = [
  { key: "plot", label: "Plot", icon: BookOpen },
  { key: "characters", label: "Character", icon: UserRound },
  { key: "environment", label: "Environment", icon: ScrollText },
  { key: "base", label: "Base", icon: Home },
  { key: "theme", label: "Theme", icon: Sparkles },
];

// เพิ่มภายหลัง (audit fix) — ถังขยะเดิมอยู่ในแถบนี้ด้วย แต่ผู้ใช้ชี้ว่ามันไม่ใช่ "เครื่องมือช่วยแต่งนิยาย"
// เหมือน Plot/Character/Environment/Base/Theme ที่เหลือ (มันคือฟีเจอร์กู้คืนข้อมูล ไม่ใช่เครื่องมือ
// สร้างเนื้อหา) เอาออกจากที่นี่ เหลือทางเข้าเดียวคือปุ่ม "ถังขยะ" บนหน้าจัดการนิยาย
// (NovelManagementPanel.tsx) ซึ่งมีอยู่แล้วคู่กับ "พรีวิวก่อนพิมพ์"
/** แถบด้านซ้ายของ World-building tool — Plot/Character/Environment/Base/Theme ดู wf_map_dm.png */
export function WriterSidebar({ novelId }: { novelId: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-48 shrink-0 rounded-card bg-brand-tan/20 p-3 dark:bg-surface-muted">
      <nav className="space-y-1">
        {tabs.map((tab) => {
          const href = `/write/${novelId}/${tab.key}`;
          const active = pathname === href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-500 text-white shadow-sm"
                  : "text-brand-brown/80 hover:bg-white/60 dark:text-neutral-300 dark:hover:bg-white/10"
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
