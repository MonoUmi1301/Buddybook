import Image from "next/image";
import Link from "next/link";
import { Eye, Heart } from "lucide-react";
import { RatingStars } from "@/components/ui/RatingStars";
import { StatPill } from "@/components/ui/StatPill";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import type { NovelSummary } from "@/lib/types";

interface NovelCardProps {
  novel: NovelSummary;
  theme?: "dark" | "light";
}

/** การ์ดนิยายแนวตั้ง — ใช้ในแถว "ติดท็อป" และแถวหมวดหมู่ต่าง ๆ ดู wf_home_dark.png */
export function NovelCard({ novel, theme = "dark" }: NovelCardProps) {
  const isDark = theme === "dark";
  return (
    <Link
      href={novel.href}
      className="group block w-36 shrink-0 sm:w-40"
    >
      <div
        className={cn(
          "relative aspect-[3/4] overflow-hidden rounded-card ring-1 transition-transform duration-200 group-hover:-translate-y-1 group-hover:ring-primary-400/50",
          isDark ? "bg-surface-muted ring-white/5" : "bg-neutral-100 ring-black/5"
        )}
      >
        <Image
          src={novel.coverImageUrl}
          alt={novel.title}
          fill
          sizes="160px"
          className="object-cover"
        />
      </div>

      <h3
        className={cn(
          "mt-2 line-clamp-1 text-sm font-semibold group-hover:text-primary-500",
          isDark ? "text-zinc-100" : "text-neutral-900"
        )}
      >
        {novel.title}
      </h3>
      <p className="line-clamp-1 text-xs text-neutral-500">โดยนักเขียน {novel.penName}</p>

      <div className="mt-1 flex items-center gap-2.5">
        <StatPill icon={Eye} value={novel.viewCount} />
        <StatPill icon={Heart} value={novel.likeCount} iconClassName="text-rose-400" />
      </div>
      <RatingStars rating={novel.rating ?? 0} className="mt-1" />

      {novel.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {novel.tags.slice(0, 2).map((tag) => (
            <Tag key={tag.label} color={tag.color} className="px-2 py-0 text-[10px]">
              {tag.label}
            </Tag>
          ))}
        </div>
      )}
    </Link>
  );
}
