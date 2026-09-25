import { formatCompactNumber } from "@/lib/format";

/** meta ใต้ caption ของ coverflow "มาแรงตอนนี้" — แยกไว้ใน lib เพราะ app/page.tsx (Server Component)
 *  เรียกใช้ตรง ๆ ไม่ได้ถ้าอยู่ในไฟล์ "use client" */
export function buildTrendingMeta(n: { view_count: number; rating?: number; review_count?: number; chapter_count?: number }) {
  return [
    { label: "ยอดวิว", value: formatCompactNumber(n.view_count) },
    { label: "คะแนน", value: n.review_count ? `★ ${(n.rating ?? 0).toFixed(1)}` : "–" },
    { label: "จำนวนตอน", value: `${(n.chapter_count ?? 0).toLocaleString()} ตอน` },
  ];
}
