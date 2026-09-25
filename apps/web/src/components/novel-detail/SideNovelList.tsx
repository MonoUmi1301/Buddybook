import Image from "next/image";
import Link from "next/link";
import { BookOpen, Eye, Star } from "lucide-react";
import { formatCompactNumber } from "@/lib/format";

export interface SideNovelItem {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  view_count: number;
  rating?: number;
  review_count?: number;
  /** ชื่อนักเขียน — ใส่เฉพาะลิสต์ที่มาจากหลายนักเขียน (นิยายที่คล้ายกัน) */
  authorName?: string;
}

interface SideNovelListProps {
  title: string;
  novels: SideNovelItem[];
  moreHref?: string;
}

/** ลิสต์นิยายแนวตั้งแบบย่อในแถบข้าง — "ผลงานอื่นของนักเขียน" / "นิยายที่คล้ายกัน" */
export function SideNovelList({ title, novels, moreHref }: SideNovelListProps) {
  if (novels.length === 0) return null;

  return (
    <section className="rounded-card border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {moreHref && (
          <Link href={moreHref} className="text-xs font-medium text-primary-600 hover:underline">
            ดูทั้งหมด
          </Link>
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {novels.map((n) => (
          <li key={n.novel_id}>
            <Link href={`/novels/${n.novel_id}`} className="group flex gap-3">
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-brand-tan/40 to-primary-200/60 ring-1 ring-black/5">
                {n.cover_image_url ? (
                  <Image src={n.cover_image_url} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BookOpen className="h-5 w-5 text-brand-brown/40" aria-hidden />
                  </div>
                )}
              </div>
              <div className="min-w-0 py-0.5">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-neutral-800 group-hover:text-primary-600">
                  {n.title}
                </p>
                {n.authorName && <p className="mt-0.5 truncate text-xs text-neutral-500">{n.authorName}</p>}
                <p className="mt-1 flex items-center gap-2.5 text-xs text-neutral-400">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" aria-hidden />
                    {formatCompactNumber(n.view_count)}
                  </span>
                  {!!n.review_count && n.rating !== undefined && (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                      {n.rating.toFixed(1)}
                    </span>
                  )}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
