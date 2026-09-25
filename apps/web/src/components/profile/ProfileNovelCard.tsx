import Image from "next/image";
import Link from "next/link";
import { BookOpen, Eye, Heart, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCompactNumber } from "@/lib/format";
import { novelStatusLabel, type NovelStatus } from "@/lib/novelLabels";

export interface ProfileNovel {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  status: NovelStatus;
  view_count: number;
  /** null = นักเขียนตั้งซ่อนยอดถูกใจไว้ */
  like_count: number | null;
  chapter_count: number;
  rating: number;
  review_count: number;
}

const statusBadge: Record<NovelStatus, string> = {
  ongoing: "bg-emerald-500 text-white",
  completed: "bg-primary-500 text-white",
  hiatus: "bg-neutral-700/80 text-white",
};

/** การ์ดผลงานแนวตั้งในหน้าโปรไฟล์นักเขียน — ปกใหญ่ + สถานะมุมซ้าย + สถิติจริงจาก GET /users/:id */
export function ProfileNovelCard({ novel }: { novel: ProfileNovel }) {
  return (
    <Link
      href={`/novels/${novel.novel_id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-neutral-200 bg-white transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"
    >
      <div className="relative aspect-[3/4] bg-gradient-to-br from-brand-tan/40 to-primary-200/60">
        {novel.cover_image_url ? (
          <Image
            src={novel.cover_image_url}
            alt={`ปกนิยาย ${novel.title}`}
            fill
            sizes="(min-width: 1280px) 260px, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-brand-brown/40" aria-hidden />
          </div>
        )}
        <span
          className={cn(
            "absolute left-2 top-2 rounded-pill px-2 py-0.5 text-[11px] font-medium shadow-sm",
            statusBadge[novel.status]
          )}
        >
          {novelStatusLabel[novel.status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900 group-hover:text-primary-600">
          {novel.title}
        </h3>
        <p className="mt-1 text-xs text-neutral-500">{novel.chapter_count.toLocaleString()} ตอน</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {formatCompactNumber(novel.view_count)}
          </span>
          {novel.like_count !== null && (
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-rose-400" aria-hidden />
              {formatCompactNumber(novel.like_count)}
            </span>
          )}
          {novel.review_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
              {novel.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
