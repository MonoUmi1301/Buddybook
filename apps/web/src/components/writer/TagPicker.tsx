"use client";

import { cn } from "@/lib/cn";

export interface TagPickerTag {
  tag_id: number;
  name: string;
}

interface TagPickerProps {
  allTags: TagPickerTag[];
  selectedIds: Set<number>;
  onChange: (next: Set<number>) => void;
  max?: number;
}

/** เลือกแท็กจากรายการที่มีอยู่แล้วด้วยปุ่มกด (multi-select toggle) — ใช้กับความสัมพันธ์ในเรื่อง
 *  ซึ่งควรเลือกจากคู่ที่มีอยู่แล้วในระบบเท่านั้น ต่างจาก TagInput ที่พิมพ์สร้างแท็กใหม่เองได้ */
export function TagPicker({ allTags, selectedIds, onChange, max = 5 }: TagPickerProps) {
  const atMax = selectedIds.size >= max;

  function toggle(tagId: number) {
    const next = new Set(selectedIds);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      if (atMax) return;
      next.add(tagId);
    }
    onChange(next);
  }

  if (allTags.length === 0) {
    return <p className="text-sm text-neutral-400">ยังไม่มีตัวเลือกในระบบ</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allTags.map((t) => {
        const active = selectedIds.has(t.tag_id);
        return (
          <button
            key={t.tag_id}
            type="button"
            onClick={() => toggle(t.tag_id)}
            disabled={!active && atMax}
            className={cn(
              "rounded-pill border px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary-500 bg-primary-500 text-white"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-50",
              !active && atMax && "cursor-not-allowed opacity-50"
            )}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
