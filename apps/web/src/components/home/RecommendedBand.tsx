import Image from "next/image";
import Link from "next/link";
import { Tag } from "@/components/ui/Tag";
import type { NovelSummary } from "@/lib/types";

/** แถบสีน้ำตาลอมส้ม "เรื่องที่คุณอาจสนใจ" คั่นกลางหน้า Home — ดู wf_home_dark.png */
export function RecommendedBand({ novels }: { novels: NovelSummary[] }) {
  return (
    <section className="-mx-4 mt-10 bg-brand-tan/90 px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-4 text-h3 text-brand-brown">เรื่องที่คุณอาจสนใจ</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {novels.map((novel) => (
            <Link
              key={novel.id}
              href={novel.href}
              className="group flex gap-3 rounded-card bg-white/90 p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                <Image
                  src={novel.coverImageUrl}
                  alt={novel.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <h3 className="line-clamp-1 text-sm font-semibold text-neutral-900 group-hover:text-brand-brown">
                  {novel.title}
                </h3>
                {novel.synopsis && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{novel.synopsis}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {novel.tags.slice(0, 2).map((tag) => (
                    <Tag key={tag.label} color={tag.color} className="px-2 py-0 text-[10px]">
                      {tag.label}
                    </Tag>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
