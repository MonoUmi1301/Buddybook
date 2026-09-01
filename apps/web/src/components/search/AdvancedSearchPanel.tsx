"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

/** เพิ่มภายหลัง (Phase S, MASTER BRIEF) — หน้าค้นหาเริ่มต้นแบบเรียบง่าย (แค่ช่องค้นหาหลัก) ตัวกรอง
 *  แบบละเอียดสไตล์ AO3 (นักเขียน/หมวดหมู่/ความสัมพันธ์/fandom/แท็กอื่นๆ) ซ่อนอยู่หลังปุ่มนี้ กาง
 *  ออกมาเป็น Collapsible Panel — เปิดค้างไว้ตั้งแต่แรกถ้ามีตัวกรองใดถูกใช้งานอยู่แล้ว (จาก URL)
 *  กันผู้ใช้งงว่าทำไมผลลัพธ์ถูกกรองอยู่ทั้งที่แผงตัวกรองถูกปิดซ่อนไว้ */
export function AdvancedSearchPanel({ defaultOpen, children }: { defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        <SlidersHorizontal className="h-4 w-4" />
        ค้นหาแบบละเอียด
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-4 grid gap-4 rounded-card border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2">
          {children}
        </div>
      )}
    </div>
  );
}
