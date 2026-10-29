import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Tag } from "@/components/ui/Tag";
import type { NovelSummary } from "@/lib/types";

const BAND_BG = "#FDEEE1";
const TAB_BG = "#E7C8AE";
const BEAR_BODY = "#D4B196";
const BEAR_DARK = "#63442A";
const EAR_INNER = "#FAD6D6";

/** หมีโผล่หลังหัวแฟ้ม — ฐานของ SVG ชิดขอบบนของแถบพื้นหลัง */
function PeekingBear({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 162 132" className={className} aria-hidden="true">
      <circle cx="52" cy="34" r="34" fill={BEAR_BODY} />
      <circle cx="53" cy="36" r="23" fill={EAR_INNER} />
      <path d="M0 132V33H66A72 82 0 0 1 138 115V132Z" fill={BEAR_BODY} />
      <circle cx="131" cy="83" r="28" fill={BEAR_BODY} />
      <ellipse cx="138" cy="81" rx="9" ry="19" transform="rotate(-25 138 81)" fill={EAR_INNER} />
      <ellipse cx="66" cy="93" rx="11.5" ry="8" transform="rotate(20 66 93)" fill={BEAR_DARK} />
    </svg>
  );
}

/** เปลือกแฟ้ม: หัวแฟ้ม + หมี + พื้นหลังยาวเต็มขอบจอ (ไม่มีกรอบมน) */
export function RecommendedShell({ children }: { children: ReactNode }) {
  return (
    <section className="mt-10 w-full">
      <div className="flex items-end">
        <h2
          className="relative z-10 flex h-[3.75rem] items-center rounded-tl-[2rem] rounded-tr-[1.6rem] sm:rounded-tr-[2.2rem] px-6 text-h3 text-brand-brown sm:h-[5.25rem] sm:px-10"
          style={{ backgroundColor: TAB_BG }}
        >
          เรื่องที่คุณอาจสนใจ
        </h2>
        <PeekingBear className="-ml-[0.31rem] h-[4.125rem] w-[5.06rem] shrink-0 sm:-ml-[0.44rem] sm:h-[5.775rem] sm:w-[7.09rem]" />
      </div>
      <div className="px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: BAND_BG }}>
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    </section>
  );
}

/** แถบ "เรื่องที่คุณอาจสนใจ" คั่นกลางหน้า Home */
export function RecommendedBand({ novels }: { novels: NovelSummary[] }) {
  return (
    <RecommendedShell>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {novels.map((novel) => (
          <Link
            key={novel.id}
            href={novel.href}
            className="group flex gap-3 rounded-card bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
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
    </RecommendedShell>
  );
}
