import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { NovelSummary } from "@/lib/types";

interface TrendingNovelCardProps {
  novel: NovelSummary;
  theme?: "dark" | "light";
}

/** การ์ดแนวนอนสำหรับแถว "ใหม่มาแรง" — ปกเล็กสี่เหลี่ยม + ข้อมูลด้านข้าง ดู wf_home_dark.png */
export function TrendingNovelCard({ novel, theme = "dark" }: TrendingNovelCardProps) {
  const isDark = theme === "dark";

  return (
    <Link
      href={novel.href}
      className={cn(
        "group flex items-center gap-3 rounded-card p-2 transition-colors",
        isDark ? "hover:bg-surface-muted" : "hover:bg-neutral-100"
      )}
    >
      <div
        className={cn(
          "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1",
          isDark ? "bg-surface-muted ring-white/5" : "bg-neutral-100 ring-black/5"
        )}
      >
        <Image src={novel.coverImageUrl} alt={novel.title} fill sizes="56px" className="object-cover" />
      </div>
      <div className="min-w-0">
        <h4
          className={cn(
            "line-clamp-1 text-sm font-semibold group-hover:text-primary-500",
            isDark ? "text-zinc-100" : "text-neutral-900"
          )}
        >
          {novel.title}
        </h4>
        <p className="line-clamp-1 text-xs text-neutral-500">นามปากกา: {novel.penName}</p>
        {novel.updatedAt && (
          <p className={cn("line-clamp-1 text-xs", isDark ? "text-neutral-600" : "text-neutral-400")}>
            อัปเดตล่าสุด: {novel.updatedAt}
          </p>
        )}
      </div>
    </Link>
  );
}
