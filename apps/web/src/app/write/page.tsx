import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import { MODERATION_STATUS_LABEL, canAppeal, type ModerationCase } from "@/lib/moderation";

interface MyNovel {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  status: "ongoing" | "completed" | "hiatus";
  visibility: "published" | "private" | "suspended";
  /** post-moderation — มีค่าเมื่อแอดมินระงับนิยายเรื่องนี้อยู่ */
  moderation_case?: ModerationCase | null;
}

const statusLabel: Record<MyNovel["status"], string> = {
  ongoing: "กำลังเขียน",
  completed: "จบแล้ว",
  hiatus: "พักเขียน",
};

const visibilityLabel: Record<MyNovel["visibility"], string> = {
  published: "เผยแพร่แล้ว",
  private: "ส่วนตัว",
  suspended: "ถูกระงับ",
};

// หน้ารวมผลงานของนักเขียน — จุดเริ่มต้นก่อนเข้าเครื่องมือ world-building/chapter editor
export default async function WriterDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const token = await getAccessToken();
  const [result, giftStats] = await Promise.all([
    callApi({
      method: "GET",
      path: "/novels/search",
      token,
      searchParams: new URLSearchParams({ mine: "true", page: "1" }),
    }),
    // เพิ่มภายหลัง (Gift donations) — จำนวนจดหมายที่ยังไม่อ่านบนปุ่มกล่องจดหมาย
    callApi({ method: "GET", path: "/me/gifts/stats", token }),
  ]);
  const unreadGifts =
    !("error" in giftStats) && giftStats.status === 200 ? ((giftStats.json as { unread_count: number }).unread_count ?? 0) : 0;

  const myNovels: MyNovel[] =
    !("error" in result) && result.status === 200 && result.json && typeof result.json === "object"
      ? ((result.json as { novels: MyNovel[] }).novels ?? [])
      : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-h2 text-neutral-900">ผลงานของฉัน</h1>
          <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/write/stats"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-pill border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <BarChart3 className="h-4 w-4" /> สถิติ
          </Link>
          <Link
            href="/write/trash"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-pill border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Trash2 className="h-4 w-4" /> นิยายที่ถูกลบ
          </Link>
          <Link
            href="/write/gifts"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-pill border border-gift-bear/60 bg-gift-paper px-4 text-sm font-medium text-gift-ink hover:bg-gift-bear/10"
          >
            กล่องจดหมาย
            {unreadGifts > 0 && (
              <span className="rounded-pill bg-gift-bear px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                {unreadGifts > 99 ? "99+" : unreadGifts}
                <span className="sr-only"> ฉบับยังไม่อ่าน</span>
              </span>
            )}
          </Link>
          </div>
        </div>

        {"error" in result && (
          <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            ตอนนี้เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณารอสักครู่แล้วรีเฟรชหน้านี้อีกครั้ง
          </p>
        )}

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          <Link
            href="/write/new"
            className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-primary-400 hover:text-primary-500"
          >
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">สร้างนิยายใหม่</span>
          </Link>

          {myNovels.map((n) => (
            <div key={n.novel_id} className="group">
              <Link href={`/write/${n.novel_id}`} className="block">
                <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-neutral-100">
                  {n.cover_image_url ? (
                    <Image src={n.cover_image_url} alt={n.title} fill sizes="200px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-300">
                      ไม่มีปก
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-pill bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                    {statusLabel[n.status]}
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-neutral-900 group-hover:text-primary-600">
                  {n.title}
                </h3>
                {n.visibility === "suspended" ? (
                  <p className="text-xs font-medium text-red-600">
                    {n.moderation_case ? MODERATION_STATUS_LABEL[n.moderation_case.status] : visibilityLabel.suspended}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500">{visibilityLabel[n.visibility]}</p>
                )}
              </Link>
              {/* post-moderation — เหตุผลที่ถูกระงับ + ทางไปยื่นอุทธรณ์ ให้เห็นตั้งแต่หน้ารวมผลงาน */}
              {n.visibility === "suspended" && n.moderation_case && (
                <div className="mt-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  <p className="flex items-center gap-1 font-semibold">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> เหตุผล
                  </p>
                  <p className="mt-0.5 line-clamp-3 break-words">{n.moderation_case.reason}</p>
                  {canAppeal(n.moderation_case) && (
                    <Link
                      href={`/write/${n.novel_id}?appeal=1`}
                      className="mt-1 inline-block font-semibold text-red-700 underline underline-offset-2 hover:text-red-800 dark:text-red-200"
                    >
                      ยื่นอุทธรณ์
                    </Link>
                  )}
                </div>
              )}
              <Link
                href={`/write/${n.novel_id}/chapters/new`}
                className="mt-1 inline-block text-xs font-medium text-primary-500 hover:text-primary-600"
              >
                + เขียนตอนใหม่
              </Link>
              <Link
                href={`/write/${n.novel_id}/trash`}
                className="ml-3 mt-1 inline-block text-xs font-medium text-neutral-400 hover:text-neutral-600"
              >
                ถังขยะ
              </Link>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
