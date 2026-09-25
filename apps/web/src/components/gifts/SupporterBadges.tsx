import { GiftImage } from "@/components/gifts/GiftImage";
import type { SupporterBadge } from "@/lib/gifts";

/** เพิ่มภายหลัง (Gift donations) — ป้ายผู้สนับสนุนบนโปรไฟล์ (เกณฑ์อยู่ที่ apps/api/src/config/supporterBadges.ts)
 *  ไอคอนเป็นรูปของขวัญ ไม่ใช้อีโมจิ ไม่มีป้ายก็ไม่แสดงอะไรเลย */
export function SupporterBadges({ badges }: { badges: SupporterBadge[] }) {
  if (badges.length === 0) return null;

  return (
    <section className="rounded-card border border-neutral-200 bg-white p-5" aria-labelledby="supporter-badges-heading">
      <h2 id="supporter-badges-heading" className="text-base font-semibold text-neutral-900">
        ป้ายผู้สนับสนุน
      </h2>
      <ul className="mt-3 space-y-2">
        {badges.map((badge) => (
          <li key={badge.id} className="flex items-center gap-3 rounded-2xl bg-gift-paper p-2 pr-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gift-surface">
              {badge.image_slug ? (
                <span className="h-8 w-8">
                  <GiftImage slug={badge.image_slug} alt="" sizes="32px" />
                </span>
              ) : (
                <span className="text-xs font-bold text-gift-bear">{badge.label.slice(0, 1)}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gift-ink">{badge.label}</span>
              <span className="block text-xs text-gift-muted">{badge.description_th}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
