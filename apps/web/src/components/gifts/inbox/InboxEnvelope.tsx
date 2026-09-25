"use client";

import { GiftImage } from "@/components/gifts/GiftImage";
import { formatRelativeThai } from "@/lib/format";
import { formatCoins, giftLabel, senderLabel, type InboxItem } from "@/lib/gifts";
import { cn } from "@/lib/cn";

interface InboxEnvelopeProps {
  item: InboxItem;
  /** ฝากำลังเปิด (แตะแล้ว ก่อน dialog การ์ดขึ้น) */
  opening: boolean;
  onOpen: () => void;
  /** โหลดรูปทันทีสำหรับแถวแรก */
  eager?: boolean;
  feePercent: number | null;
}

/** เพิ่มภายหลัง (Gift donations) — ซองจดหมายหนึ่งซองในกล่องจดหมายนักเขียน
 *  ยังไม่อ่าน = ฝาปิดพร้อมตราครั่ง, อ่านแล้ว = ฝาเปิดค้างและเห็นขอบการ์ดโผล่ */
export function InboxEnvelope({ item, opening, onOpen, eager, feePercent }: InboxEnvelopeProps) {
  const unread = !item.read_at;
  const open = opening || !unread;
  const name = senderLabel(item);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${unread ? "ยังไม่อ่าน " : ""}การ์ดจาก ${name}: ${giftLabel(item)}`}
      className={cn(
        "gift-tile group flex min-h-[44px] w-full flex-col rounded-2xl p-2 text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gift-bear focus-visible:ring-offset-2 focus-visible:ring-offset-gift-surface",
        item.hidden_at && "opacity-60"
      )}
    >
      <span className="relative mt-4 block aspect-[4/3] w-full [perspective:600px]">
        {/* การ์ดโผล่พ้นปากซองขึ้นมาเล็กน้อย (เฉพาะซองที่เปิดแล้ว) — อยู่หลังตัวซอง จึงเห็นแค่ส่วนที่พ้นขอบบน */}
        {open && (
          <span
            aria-hidden
            className="absolute inset-x-[10%] -top-[12%] h-[60%] rounded-md border border-gift-edge bg-gift-surface shadow-sm"
          />
        )}
        <span aria-hidden className="gift-envelope__body absolute inset-0 rounded-xl" />
        <span aria-hidden className="gift-envelope__pocket absolute inset-0 rounded-b-xl" />
        <span
          aria-hidden
          className={cn(
            "gift-inbox-flap absolute inset-x-0 top-0 h-[58%] rounded-t-xl",
            // แตะแล้วฝาพลิกเปิด (ช่วงสั้น ๆ ก่อน dialog ขึ้น) ซองที่อ่านแล้วไม่แสดงฝา ไม่ให้ฝาที่พลิกขึ้นไปทับแถวบน
            opening && "gift-inbox-flap--open",
            !unread && !opening && "hidden"
          )}
        />
        {unread && !opening && (
          <span aria-hidden className="gift-wax-seal absolute left-1/2 top-[44%] h-7 w-7 -translate-x-1/2 rounded-full" />
        )}

        {/* ของขวัญแปะเป็นแสตมป์มุมขวาบน */}
        <span className="gift-mini-stamp absolute right-2 top-2 z-[1] block h-12 w-12">
          {item.gift ? (
            <GiftImage slug={item.gift.slug} alt="" sizes="48px" eager={eager} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] font-bold leading-tight text-gift-bear">
              {item.amount.toLocaleString("th-TH")}
            </span>
          )}
        </span>

        {unread && (
          <span className="absolute bottom-2 left-2 z-[1] rounded-pill bg-gift-blush px-2 py-0.5 text-[10px] font-semibold text-gift-ink">
            ยังไม่อ่าน
          </span>
        )}
      </span>

      <span className="mt-2 block min-w-0 px-1">
        <span className={cn("block truncate text-sm", unread ? "font-semibold text-gift-ink" : "text-gift-ink")}>{name}</span>
        <span className="block truncate text-xs text-gift-muted" suppressHydrationWarning>
          {giftLabel(item)} · {formatRelativeThai(item.created_at)}
        </span>
        <span
          className="block truncate text-xs font-semibold tabular-nums text-gift-bear"
          title={
            item.fee_amount > 0
              ? `ยอดของขวัญ ${formatCoins(item.amount)} หักค่าธรรมเนียม${feePercent !== null ? ` ${feePercent}%` : ""} ${formatCoins(item.fee_amount)} ได้รับสุทธิ ${formatCoins(item.net_amount)}`
              : "ไม่มีค่าธรรมเนียม ได้รับเต็มจำนวน"
          }
        >
          ได้รับ {formatCoins(item.net_amount)}
        </span>
        {item.hidden_at && <span className="block text-[11px] text-gift-muted">ซ่อนอยู่</span>}
      </span>
    </button>
  );
}
