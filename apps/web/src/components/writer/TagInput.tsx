"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TagInputTag {
  tag_id: number;
  name: string;
}

interface TagInputValue {
  selectedIds: Set<number>;
  newNames: string[];
}

interface TagInputProps {
  allTags: TagInputTag[];
  value: TagInputValue;
  onChange: (next: TagInputValue) => void;
  max?: number;
}

/** เพิ่มภายหลัง (Phase I) — แท็กแบบพิมพ์เองได้ (ReadAWrite-style) แทนปุ่ม toggle รายการคงที่เดิม
 *  เลือกแท็กที่มีอยู่แล้วจาก autocomplete หรือพิมพ์ชื่อใหม่แล้วกด Enter/comma เพื่อสร้างชิปใหม่
 *  ฝั่ง backend จะ find-or-create ให้เองตอน submit (ดู resolveTagNames ใน novels.service.ts) */
export function TagInput({ allTags, value, onChange, max = 10 }: TagInputProps) {
  const [query, setQuery] = useState("");
  const { selectedIds, newNames } = value;
  const totalCount = selectedIds.size + newNames.length;
  const atMax = totalCount >= max;

  const selectedTags = allTags.filter((t) => selectedIds.has(t.tag_id));

  const suggestions = query.trim()
    ? allTags
        .filter(
          (t) =>
            !selectedIds.has(t.tag_id) && t.name.toLowerCase().includes(query.trim().toLowerCase())
        )
        .slice(0, 6)
    : [];

  function addExisting(tagId: number) {
    if (atMax) return;
    onChange({ selectedIds: new Set([...selectedIds, tagId]), newNames });
    setQuery("");
  }

  function addNew(rawName: string) {
    const name = rawName.trim();
    if (!name || atMax) return;

    // ถ้าชื่อตรงกับแท็กที่มีอยู่แล้วพอดี (ไม่สนตัวพิมพ์เล็ก/ใหญ่ และไม่สน #) ให้เลือกอันนั้นแทนสร้างซ้ำ
    const bareName = name.replace(/^#/, "");
    const existingMatch = allTags.find((t) => t.name.toLowerCase() === bareName.toLowerCase());
    if (existingMatch) {
      addExisting(existingMatch.tag_id);
      return;
    }
    // แท็กใหม่ (ยังไม่มีในระบบ) แสดงเป็นแฮชแท็กเสมอ เพื่อให้ต่างจากแท็กที่มีอยู่แล้วเห็นชัด
    const hashName = `#${bareName}`;
    if (newNames.some((n) => n.toLowerCase() === hashName.toLowerCase())) {
      setQuery("");
      return;
    }
    onChange({ selectedIds, newNames: [...newNames, hashName] });
    setQuery("");
  }

  function removeExisting(tagId: number) {
    const next = new Set(selectedIds);
    next.delete(tagId);
    onChange({ selectedIds: next, newNames });
  }

  function removeNew(name: string) {
    onChange({ selectedIds, newNames: newNames.filter((n) => n !== name) });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addNew(query);
    } else if (e.key === "Backspace" && query === "") {
      if (newNames.length > 0) removeNew(newNames[newNames.length - 1]);
      else if (selectedTags.length > 0) removeExisting(selectedTags[selectedTags.length - 1].tag_id);
    }
  }

  return (
    <div>
      {(selectedTags.length > 0 || newNames.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedTags.map((t) => (
            <span
              key={t.tag_id}
              className="inline-flex items-center gap-1 rounded-pill border border-primary-500 bg-primary-500 px-3 py-1.5 text-sm font-medium text-white"
            >
              {t.name}
              <button type="button" onClick={() => removeExisting(t.tag_id)} aria-label={`ลบแท็ก ${t.name}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {newNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-pill border border-teal-500 bg-teal-500 px-3 py-1.5 text-sm font-medium text-white"
            >
              {name}
              <span className="text-[10px] opacity-80">ใหม่</span>
              <button type="button" onClick={() => removeNew(name)} aria-label={`ลบแท็ก ${name}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={atMax}
          placeholder={atMax ? `เพิ่มได้สูงสุด ${max} แท็ก` : "พิมพ์ชื่อแท็ก แล้วกด Enter หรือ ,"}
          className={cn(
            "h-11 w-full rounded-lg border border-neutral-300 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-400",
            "focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100",
            "disabled:cursor-not-allowed disabled:bg-neutral-100"
          )}
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
            {suggestions.map((s) => (
              <button
                key={s.tag_id}
                type="button"
                onClick={() => addExisting(s.tag_id)}
                className="block w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-primary-50"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
