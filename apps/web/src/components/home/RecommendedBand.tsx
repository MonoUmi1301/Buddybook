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
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="40" cy="17" r="15" fill={BEAR_BODY} />
      <circle cx="40" cy="19" r="9" fill={EAR_INNER} />
      <circle cx="84" cy="42" r="12" fill={BEAR_BODY} />
      <circle cx="84" cy="43" r="7" fill={EAR_INNER} />
      <path d="M0 100V52Q0 28 24 28H66Q92 28 92 56V100Z" fill={BEAR_BODY} />
      <ellipse cx="55" cy="62" rx="5" ry="3.5" transform="rotate(25 55 62)" fill={BEAR_DARK} />
    </svg>
  );
}

/** เปลือกแฟ้ม: หัวแฟ้ม + หมี + พื้นหลังยาวเต็มขอบจอ (ไม่มีกรอบมน) */
export function RecommendedShell({ children }: { children: ReactNode }) {
  return (
    <section className="mt-10 w-full">
      <div className="flex items-end">
        <h2
          className="relative z-10 rounded-tr-[2.5rem] px-6 pb-2 pt-4 text-h3 text-brand-brown sm:px-10 sm:pt-5"
          style={{ backgroundColor: TAB_BG }}
        >
          เรื่องที่คุณอาจสนใจ
        </h2>
        <PeekingBear className="-ml-6 h-14 w-14 shrink-0 sm:h-[5.5rem] sm:w-[5.5rem]" />
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
