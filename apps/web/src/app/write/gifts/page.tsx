import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { GiftInbox } from "@/components/gifts/inbox/GiftInbox";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import { getPenName } from "@/lib/displayName";
import type { InboxPage, InboxStats } from "@/lib/gifts";

// เพิ่มภายหลัง (Gift donations) — กล่องจดหมายของขวัญในแดชบอร์ดนักเขียน
// ?open=<donation_id> มาจากลิงก์ในแจ้งเตือน "… ส่งกาแฟ x3 ให้คุณ พร้อมการ์ด"
export default async function GiftInboxPage({ searchParams }: { searchParams: { open?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const token = getAccessToken();
  const [inboxResult, statsResult] = await Promise.all([
    callApi({ method: "GET", path: "/me/gifts/received", token }),
    callApi({ method: "GET", path: "/me/gifts/stats", token }),
  ]);

  const inbox = !("error" in inboxResult) && inboxResult.status === 200 ? (inboxResult.json as InboxPage) : null;
  const stats = !("error" in statsResult) && statsResult.status === 200 ? (statsResult.json as InboxStats) : null;

  return (
    <div className="flex min-h-screen flex-col bg-gift-surface">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/write" className="inline-flex min-h-[44px] items-center gap-1 text-sm text-gift-muted hover:text-gift-ink">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          ผลงานของฉัน
        </Link>
        <h1 className="mt-1 text-h2 text-gift-ink">กล่องจดหมาย</h1>
        <p className="mt-1 text-sm text-gift-muted">ของขวัญและการ์ดจากนักอ่าน ข้อความส่วนตัวเห็นได้เฉพาะคุณ</p>

        {!inbox ? (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            โหลดกล่องจดหมายไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง
          </p>
        ) : (
          <div className="mt-6">
            <GiftInbox
              authorName={getPenName(user)}
              initialItems={inbox.items}
              initialCursor={inbox.next_cursor}
              initialStats={stats}
              openId={searchParams.open}
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
