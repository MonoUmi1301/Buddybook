"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const sortOptions: { value: "newest" | "views"; label: string }[] = [
  { value: "newest", label: "ใหม่ล่าสุด" },
  { value: "views", label: "ยอดนิยม" },
];

/** เพิ่มภายหลัง (Phase K) — เดิม sort=newest|views ทำงานได้จริงฝั่ง backend อยู่แล้ว แต่ไม่มี UI
 *  ให้เปลี่ยนในหน้าค้นหาเลย เข้าถึงได้แค่ผ่าน URL ตรง ๆ หรือลิงก์ "ดูทั้งหมด" จากหน้า Home เท่านั้น */
export function SearchSortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") === "views" ? "views" : "newest";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={currentSort}
      onChange={(e) => handleChange(e.target.value)}
      className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none"
    >
      {sortOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
