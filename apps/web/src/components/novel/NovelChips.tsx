import Link from "next/link";
import { Tag, type TagColor } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";

type TagRef = { tag_id: number; name: string };

export interface NovelChipSource {
  format?: "multi_chapter" | "one_shot" | null;
  content_rating?: "all_ages" | "teen" | "mature" | null;
  is_translated?: boolean | null;
  primary_tag?: TagRef | null;
  secondary_tag?: TagRef | null;
  tags?: TagRef[] | null;
}

const formatLabel = { multi_chapter: "แบ่งหลายตอน", one_shot: "จบในตอนเดียว" } as const;
const contentRatingLabel = { all_ages: "ทุกวัย", teen: "13+", mature: "18+" } as const;

interface Chip {
  key: string;
  label: string;
  color: TagColor;
  href?: string;
}

/**
 * เพิ่มภายหลัง — แถวชิปสีของนิยาย (รูปแบบ · เรต · งานแปล · หมวดหมู่หลัก/รอง · แท็ก) ชุดสีเดียวกับหน้าจัดการนิยาย
 * ใช้ในหน้ารายละเอียดนิยาย (linked = กดแล้วไปค้นหาแท็กนั้น) และการ์ดผลค้นหา (การ์ดเป็นลิงก์อยู่แล้ว ห้ามซ้อน <a>)
 */
export function NovelChips({
  novel,
  linked = false,
  showRating = true,
  max,
  className,
}: {
  novel: NovelChipSource;
  linked?: boolean;
  /** หน้ารายละเอียดมีป้ายเรตด้านบนอยู่แล้ว ปิดไว้ไม่ให้ซ้ำ */
  showRating?: boolean;
  /** จำกัดจำนวนชิป ที่เหลือรวมเป็น +N */
  max?: number;
  className?: string;
}) {
  const chips: Chip[] = [];
  if (novel.format) chips.push({ key: "format", label: formatLabel[novel.format], color: "sky" });
  if (showRating && novel.content_rating) {
    chips.push({ key: "rating", label: contentRatingLabel[novel.content_rating], color: "violet" });
  }
  if (novel.is_translated) chips.push({ key: "tr", label: "งานแปล", color: "amber" });

  const genreIds = new Set<number>();
  for (const g of [novel.primary_tag, novel.secondary_tag]) {
    if (!g || genreIds.has(g.tag_id)) continue;
    genreIds.add(g.tag_id);
    chips.push({ key: `g-${g.tag_id}`, label: g.name, color: "teal", href: `/search?genre_ids=${g.tag_id}` });
  }
  // แท็กเดียวกับหมวดหมู่หลัก/รองไม่ต้องขึ้นซ้ำ
  for (const t of novel.tags ?? []) {
    if (genreIds.has(t.tag_id)) continue;
    chips.push({ key: `t-${t.tag_id}`, label: t.name, color: "slate", href: `/search?tag_ids=${t.tag_id}` });
  }

  if (chips.length === 0) return null;
  const shown = max !== undefined ? chips.slice(0, max) : chips;
  const hidden = chips.length - shown.length;

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="แท็ก">
      {shown.map((c) => (
        <li key={c.key}>
          {linked && c.href ? (
            <Link href={c.href} className="rounded-pill transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
              <Tag color={c.color}>{c.label}</Tag>
            </Link>
          ) : (
            <Tag color={c.color}>{c.label}</Tag>
          )}
        </li>
      ))}
      {hidden > 0 && (
        <li>
          {/* ไม่ใช้ <Tag> — cn ไม่ merge class Tailwind ที่ชนกัน สีพื้นจะไม่ถูกแทน */}
          <span
            className="inline-flex items-center rounded-pill bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
            title={`อีก ${hidden} แท็ก`}
          >
            +{hidden}
          </span>
        </li>
      )}
    </ul>
  );
}
