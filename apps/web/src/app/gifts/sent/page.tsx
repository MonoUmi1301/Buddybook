import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LetterCard } from "@/components/gifts/LetterCard";
import { Avatar } from "@/components/ui/Avatar";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import { getPenName } from "@/lib/displayName";
import { timeAgo } from "@/lib/notifications";
import { ANONYMOUS_NAME, giftLabel, type GiftSummary, type GiftUser } from "@/lib/gifts";
import type { CardTemplate } from "@/lib/donate-assets";

interface SentItem {
  donation_id: string;
  gift: GiftSummary | null;
  quantity: number;
  amount: number;
  card_template: CardTemplate | null;
  is_anonymous: boolean;
  message: string | null;
  signature_name: string | null;
  recipient: GiftUser;
  novel: { novel_id: string; title: string } | null;
  chapter: { chapter_id: string; chapter_number: number; title: string } | null;
  thank_message: string | null;
  thanked_at: string | null;
  created_at: string;
}

// เพิ่มภายหลัง — ของขวัญที่ฉันส่ง + คำขอบคุณจากนักเขียน (แสดงใต้การ์ดแบบคอมเมนต์ตอบกลับ)
// แจ้งเตือน "… ตอบขอบคุณของขวัญของคุณ" ลิงก์มาที่ #gift-<donation_id> — เบราว์เซอร์เลื่อนไปเองและไฮไลต์ด้วย :target
export default async function SentGiftsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/gifts/sent");

  const result = await callApi({ method: "GET", path: "/me/gifts/sent", token: getAccessToken() });
  const items = !("error" in result) && result.status === 200 ? (result.json as { items: SentItem[] }).items : null;
  const myName = getPenName(user);

  return (
    <div className="flex min-h-screen flex-col bg-gift-surface">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-h2 text-gift-ink">ของขวัญที่ฉันส่ง</h1>
        <p className="mt-1 text-sm text-gift-muted">การ์ดที่คุณส่งให้นักเขียน และคำขอบคุณที่ได้รับกลับมา</p>

        {!items ? (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            โหลดรายการไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง
          </p>
        ) : items.length === 0 ? (
          <p className="mt-6 text-sm text-gift-muted">ยังไม่เคยส่งของขวัญ</p>
        ) : (
          <ul className="mt-6 space-y-6">
            {items.map((item) => {
              const recipientName = getPenName(item.recipient);
              const signature = item.is_anonymous ? ANONYMOUS_NAME : item.signature_name?.trim() || myName;
              return (
                <li
                  key={item.donation_id}
                  id={`gift-${item.donation_id}`}
                  className="scroll-mt-24 rounded-card border border-gift-edge bg-white/60 p-4 target:ring-2 target:ring-gift-bear dark:bg-white/5 sm:p-5"
                >
                  <p className="mb-3 text-sm text-gift-muted">
                    <span className="font-semibold text-gift-ink">{giftLabel(item)}</span> ให้ {recipientName}
                    {item.novel && (
                      <>
                        {" · "}
                        <Link href={`/novels/${item.novel.novel_id}`} className="hover:text-gift-ink hover:underline">
                          {item.novel.title}
                        </Link>
                      </>
                    )}
                    {" · "}
                    {timeAgo(item.created_at)}
                  </p>

                  {item.message?.trim() ? (
                    <LetterCard
                      template={item.card_template ?? "stamp"}
                      recipientName={recipientName}
                      message={item.message}
                      signature={signature}
                    />
                  ) : (
                    <p className="text-sm italic text-gift-muted">ส่งโดยไม่มีการ์ด</p>
                  )}

                  {item.thank_message ? (
                    <div className="mt-4 flex gap-3">
                      <Avatar src={item.recipient.avatar_url ?? undefined} alt={recipientName} size="sm" />
                      <div className="min-w-0 flex-1 rounded-lg bg-gift-bear/10 px-4 py-2.5">
                        <p className="text-sm font-medium text-gift-ink">
                          {recipientName} <span className="font-normal text-gift-muted">ตอบขอบคุณ</span>
                        </p>
                        <p className="whitespace-pre-line break-words text-sm text-gift-ink">{item.thank_message}</p>
                        {item.thanked_at && <p className="mt-1 text-xs text-gift-muted">{timeAgo(item.thanked_at)}</p>}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-gift-muted">ยังไม่มีคำขอบคุณจากนักเขียน</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <Footer />
    </div>
  );
}
