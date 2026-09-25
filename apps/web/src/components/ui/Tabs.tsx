"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  className?: string;
}

/** แท็บแบบ segmented (พื้นเทา แท็บที่เลือกเป็นการ์ดขาว) — ซิงก์กับ URL hash (#reviews ฯลฯ)
 *  เพื่อให้ลิงก์จากที่อื่นเปิดแท็บที่ต้องการได้ตรง ๆ และกดย้อนกลับแล้วไม่หลุดแท็บ
 *  ทุกแผงถูก render ไว้ตั้งแต่ฝั่ง server (แค่ซ่อนด้วย hidden) — เนื้อหายังอยู่ใน HTML สำหรับ SEO */
export function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const baseId = useId();
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);

  const tabIds = tabs.map((t) => t.id).join(",");
  useEffect(() => {
    function syncFromHash() {
      const hash = window.location.hash.slice(1);
      if (tabIds.split(",").includes(hash)) setActive(hash);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [tabIds]);

  function select(id: string) {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = tabs[(index + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    select(next.id);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        className="scrollbar-hide flex gap-1 overflow-x-auto rounded-card bg-neutral-100 p-1"
      >
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              id={`${baseId}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                selected
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn("ml-1.5 text-xs", selected ? "text-primary-500" : "text-neutral-400")}>
                  ({t.count.toLocaleString()})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((t) => (
        <div
          key={t.id}
          id={`${baseId}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${t.id}`}
          hidden={t.id !== active}
          className="pt-5"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
