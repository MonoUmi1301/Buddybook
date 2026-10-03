import Link from "next/link";
import { cn } from "@/lib/cn";
import type { NovelDetailData } from "@/components/novel-detail/NovelHero";

type TagSource = Pick<NovelDetailData, "primary_tag" | "secondary_tag" | "tags">;

/** ชิปแท็กของนิยาย — หมวดหมู่หลัก/รองขึ้นก่อน (เน้นสีแบรนด์) ตามด้วยแท็กทั่วไป กันชื่อซ้ำถ้าแท็กเดียวกันอยู่ทั้งสองที่
 *  กดแล้วไปหน้าค้นหาด้วย genre_ids / tag_ids ตาม unified search */
export function NovelTagList({ novel, className }: { novel: TagSource; className?: string }) {
  const genreTags = [novel.primary_tag, novel.secondary_tag].filter((t): t is { tag_id: number; name: string } => !!t);
  const genreIds = new Set(genreTags.map((t) => t.tag_id));
  const otherTags = novel.tags.filter((t) => !genreIds.has(t.tag_id));

  if (genreTags.length === 0 && otherTags.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="แท็ก">
      {genreTags.map((t) => (
        <li key={`g-${t.tag_id}`}>
          <Link
            href={`/search?genre_ids=${t.tag_id}`}
            className="inline-flex rounded-full border border-primary-500/25 bg-primary-500/10 px-3 py-1 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-500/20 dark:border-primary-400/30 dark:bg-primary-400/10 dark:text-primary-300 dark:hover:bg-primary-400/20"
          >
            {t.name}
          </Link>
        </li>
      ))}
      {otherTags.map((t) => (
        <li key={t.tag_id}>
          <Link
            href={`/search?tag_ids=${t.tag_id}`}
            className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm text-neutral-600 transition-colors hover:border-primary-300 hover:bg-primary-500/5 hover:text-primary-600 dark:hover:border-primary-400/50 dark:hover:text-primary-300"
          >
            {t.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
