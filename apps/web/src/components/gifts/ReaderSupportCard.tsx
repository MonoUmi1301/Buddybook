import { Avatar } from "@/components/ui/Avatar";
import { GiftButton } from "@/components/gifts/GiftButton";
import { GiftImage } from "@/components/gifts/GiftImage";
import { LetterCard } from "@/components/gifts/LetterCard";
import { formatCompactNumber } from "@/lib/format";
import { formatCoins, publicCardSignature, type GiftTarget, type PublicGifts } from "@/lib/gifts";
import { cn } from "@/lib/cn";

interface ReaderSupportCardProps {
  data: PublicGifts | null;
  /** ผู้รับ — ใช้ทั้งเป็น "ถึง …" บนการ์ดและเป้าหมายของปุ่มส่งของขวัญ */
  target: GiftTarget;
  viewer: { user_id: string; name: string } | null;
  /** false = ไม่แสดงปุ่มส่งของขวัญ (เช่น นิยายที่ปิดรับของขวัญ) */
  canSend?: boolean;
}

const rankClasses = ["bg-amber-400 text-white", "bg-neutral-300 text-neutral-700", "bg-brand-tan text-white"];

/**
 * เพิ่มภายหลัง (Gift donations) — การ์ด "กำลังใจจากนักอ่าน" แถบข้างหน้านิยายและหน้านักเขียน (แทน DonorList เดิม)
 * ข้อมูลจาก GET /authors/:id/gifts/public — API ส่งมาเฉพาะการ์ดที่ผู้ส่งเลือกเปิดสาธารณะ ข้อความส่วนตัว
 * ไม่มีทางมาถึงหน้านี้ ผู้ส่งนิรนามไม่ติดอันดับ และการ์ดของผู้ส่งนิรนามไม่แสดงชื่อ
 */
export function ReaderSupportCard({ data, target, viewer, canSend = true }: ReaderSupportCardProps) {
  const empty = !data || (data.total_gifts === 0 && data.top_supporters.length === 0 && data.recent_cards.length === 0);

  return (
    <section className="rounded-card border border-neutral-200 bg-white p-5" aria-labelledby="reader-support-heading">
      <h2 id="reader-support-heading" className="text-base font-semibold text-neutral-900">
        กำลังใจจากนักอ่าน
      </h2>
      {data && data.total_gifts > 0 && (
        <p className="mt-0.5 text-xs text-neutral-500">ได้รับของขวัญแล้ว {data.total_gifts.toLocaleString("th-TH")} ชิ้น</p>
      )}

      {empty ? (
        <p className="mt-3 text-sm text-neutral-500">ยังไม่มีของขวัญ เป็นคนแรกที่ส่งกำลังใจให้ {target.authorName}</p>
      ) : (
        <>
          {data.gift_counts.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="ของขวัญที่ได้รับ">
              {data.gift_counts.slice(0, 6).map(({ gift, count }) => (
                <li
                  key={gift.gift_id}
                  className="flex items-center gap-1.5 rounded-pill bg-gift-paper py-1 pl-1 pr-3 text-xs text-gift-ink"
                  title={`${gift.name_th} ${count.toLocaleString("th-TH")} ชิ้น`}
                >
                  <span className="h-7 w-7 shrink-0">
                    <GiftImage slug={gift.slug} alt="" sizes="28px" />
                  </span>
                  <span>{gift.name_th}</span>
                  <span className="font-semibold tabular-nums">{formatCompactNumber(count)}</span>
                </li>
              ))}
            </ul>
          )}

          {data.top_supporters.length > 0 && (
            <>
              <p className="mt-4 text-xs font-medium text-primary-600">ผู้สนับสนุนสูงสุด</p>
              <ol className="mt-2 space-y-2">
                {data.top_supporters.map(({ user, total_coins }, i) => (
                  <li key={user.user_id} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        rankClasses[i] ?? "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      {i + 1}
                    </span>
                    <Avatar src={user.avatar_url ?? undefined} alt={user.username} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">{user.pen_name || user.username}</span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                      {formatCoins(total_coins)}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {data.recent_cards.length > 0 && (
            <>
              <p className="mt-5 text-xs font-medium text-primary-600">การ์ดล่าสุด</p>
              <ul className="mt-2 space-y-3">
                {data.recent_cards.slice(0, 3).map((card) => (
                  <li key={card.donation_id}>
                    <LetterCard
                      template="stamp"
                      size="mini"
                      recipientName={target.authorName}
                      message={card.message}
                      signature={publicCardSignature(card)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {canSend && <GiftButton variant="sidebar" viewer={viewer} className="mt-4" target={target} />}
    </section>
  );
}
