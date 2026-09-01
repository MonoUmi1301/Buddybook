"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface PresetTag {
  tag_id: number;
  name: string;
}

/** เพิ่มภายหลัง (Phase S, MASTER BRIEF) — สายความสัมพันธ์เป็น "Preset Buttons" ไม่ใช่ autocomplete
 *  แบบ genre/fandom/แท็กอื่นๆ (มีแค่ 5 preset คงที่ ไม่ต้องพิมพ์ค้นหา) เขียนลง query param
 *  pairing_ids แยกจาก genre_ids/fandom_ids/tag_ids ตามที่ระบุ */
export function PairingPresetButtons({ tags }: { tags: PresetTag[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeIds = (searchParams.get("pairing_ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  function toggle(tagId: number) {
    const next = activeIds.includes(tagId) ? activeIds.filter((id) => id !== tagId) : [...activeIds, tagId];
    const params = new URLSearchParams(searchParams.toString());
    if (next.length) params.set("pairing_ids", next.join(","));
    else params.delete("pairing_ids");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-neutral-700">สายความสัมพันธ์</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const isActive = activeIds.includes(tag.tag_id);
          return (
            <button
              key={tag.tag_id}
              type="button"
              onClick={() => toggle(tag.tag_id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-primary-300 hover:bg-primary-50"
              )}
            >
              {isActive && <Check className="h-3.5 w-3.5" />}
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
