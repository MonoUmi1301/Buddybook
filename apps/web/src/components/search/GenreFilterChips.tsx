"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface GenreTag {
  tag_id: number;
  name: string;
  parent_tag_id?: number | null;
}

function readIds(searchParams: URLSearchParams, key: string): number[] {
  return (searchParams.get(key) ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** เพิ่มภายหลัง (audit fix, search UX polish) — เดิมเป็นปุ่ม chip 7 อันโชว์ตลอด (กินพื้นที่แนวตั้งเยอะ
 *  เกินไป ตามที่ผู้ใช้ทักท้วง) เปลี่ยนเป็น select/combo box แบบยุบเก็บได้: กดเปิด dropdown แสดงลิสต์
 *  หมวดหลักทั้ง 7 ให้ติ๊กเลือกได้หลายอัน (dropdown ไม่ปิดเองตอนเลือก เพื่อให้เลือกได้หลายรอบต่อเนื่อง
 *  โดยไม่ต้องเปิดใหม่ทุกครั้ง — จุดที่ผู้ใช้กังวลว่า select เดี่ยวจะเลือกพร้อมกันหลายอันไม่ได้) หมวดที่
 *  เลือกแล้วโชว์เป็น chip ลบได้ด้านล่าง ตัว trigger เอง — ยังคงพฤติกรรมเดิม: เลือกหมวดหลักที่มี
 *  หมวดรอง (children ตาม parent_tag_id) จะโชว์ chip หมวดรองต่อท้าย chip นั้นทันที */
export function GenreFilterChips({ genreTags }: { genreTags: GenreTag[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const topLevel = genreTags.filter((t) => !t.parent_tag_id);
  const childrenByParent = new Map<number, GenreTag[]>();
  for (const t of genreTags) {
    if (t.parent_tag_id) {
      const list = childrenByParent.get(t.parent_tag_id) ?? [];
      list.push(t);
      childrenByParent.set(t.parent_tag_id, list);
    }
  }

  const activeGenreIds = readIds(searchParams, "genre_ids");
  const activeSubGenreIds = readIds(searchParams, "sub_genre_ids");
  const selectedTopLevel = topLevel.filter((t) => activeGenreIds.includes(t.tag_id));

  function pushParams(genreIds: number[], subGenreIds: number[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (genreIds.length) params.set("genre_ids", genreIds.join(","));
    else params.delete("genre_ids");
    if (subGenreIds.length) params.set("sub_genre_ids", subGenreIds.join(","));
    else params.delete("sub_genre_ids");
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleGenre(tag: GenreTag) {
    const isActive = activeGenreIds.includes(tag.tag_id);
    if (isActive) {
      // ยกเลิกหมวดหลัก — เอาหมวดรองของหมวดนี้ที่เคยเลือกไว้ออกด้วย ไม่งั้นจะเหลือ filter
      // ที่มองไม่เห็น (chip หมวดรองหายไปจาก UI แล้ว) แต่ยังกรองผลลัพธ์อยู่เงียบ ๆ
      const childIds = (childrenByParent.get(tag.tag_id) ?? []).map((c) => c.tag_id);
      pushParams(
        activeGenreIds.filter((id) => id !== tag.tag_id),
        activeSubGenreIds.filter((id) => !childIds.includes(id))
      );
    } else {
      pushParams([...activeGenreIds, tag.tag_id], activeSubGenreIds);
    }
  }

  function toggleSubGenre(tag: GenreTag) {
    const isActive = activeSubGenreIds.includes(tag.tag_id);
    pushParams(
      activeGenreIds,
      isActive ? activeSubGenreIds.filter((id) => id !== tag.tag_id) : [...activeSubGenreIds, tag.tag_id]
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <p className="mb-1.5 text-sm font-medium text-neutral-700">หมวดหมู่</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 hover:border-primary-300 focus:border-primary-400 focus:outline-none"
      >
        <span className={selectedTopLevel.length ? "text-neutral-900" : "text-neutral-400"}>
          {selectedTopLevel.length ? `เลือกแล้ว ${selectedTopLevel.length} หมวด` : "เลือกหมวดหมู่..."}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {topLevel.map((tag) => {
            const isActive = activeGenreIds.includes(tag.tag_id);
            return (
              <button
                key={tag.tag_id}
                type="button"
                onClick={() => toggleGenre(tag)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-primary-50"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isActive ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-300 bg-white"
                  )}
                >
                  {isActive && <Check className="h-3 w-3" />}
                </span>
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      {selectedTopLevel.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {selectedTopLevel.map((tag) => {
            const children = childrenByParent.get(tag.tag_id) ?? [];
            return (
              <div key={tag.tag_id}>
                <span className="inline-flex items-center gap-1 rounded-pill border border-primary-500 bg-primary-500 px-3 py-1 text-xs font-medium text-white">
                  {tag.name}
                  <button type="button" onClick={() => toggleGenre(tag)} aria-label={`เอา ${tag.name} ออก`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>

                {children.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 border-l-2 border-primary-100 py-0.5 pl-3">
                    {children.map((child) => {
                      const isChildActive = activeSubGenreIds.includes(child.tag_id);
                      return (
                        <button
                          key={child.tag_id}
                          type="button"
                          onClick={() => toggleSubGenre(child)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors",
                            isChildActive
                              ? "border-primary-400 bg-primary-100 text-primary-700"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-primary-300 hover:bg-primary-50"
                          )}
                        >
                          {isChildActive && <Check className="h-3 w-3" />}
                          {child.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
