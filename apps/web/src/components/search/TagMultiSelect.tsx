"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

interface SelectableTag {
  tag_id: number;
  name: string;
}

interface TagMultiSelectProps {
  label: string;
  allTags: SelectableTag[];
  placeholder?: string;
  /** เพิ่มภายหลัง (Phase S, MASTER BRIEF) — แต่ละกลุ่ม (genre/fandom/แท็กอื่นๆ) เขียนคนละ query
   *  param แยกกันตามที่ระบุ (genre_ids/fandom_ids/tag_ids) ไม่รวมเป็น tag_ids เดียวเหมือนเดิมอีก */
  paramName?: string;
}

/** เพิ่มภายหลัง (Phase O, แยก param ตาม category ใน Phase S) — ตัวเลือกแท็กหลายอันพร้อมกันแบบ AO3
 *  (เลือก "แฟนตาซี" + "ต่างโลก" พร้อมกัน ต้องเจอเฉพาะเรื่องที่มีทั้งคู่ — AND semantics ฝั่ง backend
 *  อยู่แล้วใน searchNovels ซึ่งรวมทุก id-list param เข้าด้วยกันก่อน AND ทั้งชุด) */
export function TagMultiSelect({ label, allTags, placeholder, paramName = "tag_ids" }: TagMultiSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  const activeIds = (searchParams.get(paramName) ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const activeTags = allTags.filter((t) => activeIds.includes(t.tag_id));

  const suggestions = query.trim()
    ? allTags
        .filter((t) => !activeIds.includes(t.tag_id) && t.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  function navigateWithTagIds(nextIds: number[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextIds.length) params.set(paramName, nextIds.join(","));
    else params.delete(paramName);
    router.push(`${pathname}?${params.toString()}`);
  }

  function addTag(tagId: number) {
    navigateWithTagIds([...activeIds, tagId]);
    setQuery("");
  }

  function removeTag(tagId: number) {
    navigateWithTagIds(activeIds.filter((id) => id !== tagId));
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-neutral-700">{label}</p>
      {activeTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {activeTags.map((t) => (
            <span
              key={t.tag_id}
              className="inline-flex items-center gap-1 rounded-pill border border-primary-500 bg-primary-500 px-3 py-1 text-xs font-medium text-white"
            >
              {t.name}
              <button type="button" onClick={() => removeTag(t.tag_id)} aria-label={`เอา ${t.name} ออก`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? `ค้นหา${label}...`}
          className="h-9 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none"
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
            {suggestions.map((s) => (
              <button
                key={s.tag_id}
                type="button"
                onClick={() => addTag(s.tag_id)}
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
