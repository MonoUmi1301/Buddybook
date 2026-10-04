import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronLeft, Coins, Eye, Gift, Heart, Library, MessageCircle, Star, Users } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { DailyViewsChart } from "@/components/stats/DailyViewsChart";
import { SentimentPanel } from "@/components/stats/SentimentPanel";
import { ChapterTable } from "@/components/stats/ChapterTable";
import type { NovelOverviewRow, NovelStats } from "@/components/stats/types";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import { cn } from "@/lib/cn";

const RANGES = [7, 30, 90] as const;

/**
 * gap 3.1 + 3.5 — หน้าสถิติ (Userflow: หน้าสถิติ → แสดงสถิตินิยายของฉัน)
 * desktop-first: แถบเลือกเรื่อง + ตัวเลขสรุป 4 คอลัมน์ + กราฟ/ความรู้สึกผู้อ่าน + ตารางรายตอน
 * iPad: ตัวเลข 3 คอลัมน์ / มือถือ: 2 คอลัมน์, แถบเลือกเรื่องเลื่อนข้างในกรอบตัวเอง
 */
export default async function WriterStatsPage({ searchParams }: { searchParams: { novel?: string; days?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const token = getAccessToken();

  const overviewRes = await callApi({ method: "GET", path: "/me/stats/novels", token });
  const novels =
    !("error" in overviewRes) && overviewRes.status === 200 ? (overviewRes.json as { novels: NovelOverviewRow[] }).novels : [];
  const days = RANGES.includes(Number(searchParams.days) as (typeof RANGES)[number]) ? Number(searchParams.days) : 30;
  const selectedId = novels.some((n) => n.novel_id === searchParams.novel) ? searchParams.novel! : novels[0]?.novel_id;

  let stats: NovelStats | null = null;
  if (selectedId) {
    const res = await callApi({
      method: "GET",
      path: `/me/stats/novels/${selectedId}`,
      token,
      searchParams: new URLSearchParams({ days: String(days) }),
    });
    if (!("error" in res) && res.status === 200) stats = res.json as NovelStats;
  }

  const href = (novel: string, d: number) => `/write/stats?novel=${novel}&days=${d}`;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/write" className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-500">
          <ChevronLeft className="h-4 w-4" /> ผลงานของฉัน
        </Link>
        <h1 className="text-h2 text-neutral-900">สถิตินิยายของฉัน</h1>

        {novels.length === 0 ? (
          <div className="mt-6 rounded-card border border-dashed border-neutral-300 px-6 py-16 text-center text-sm text-neutral-500">
            ยังไม่มีนิยาย —{" "}
            <Link href="/write/new" className="font-medium text-primary-600 hover:underline">
              สร้างเรื่องแรก
            </Link>
          </div>
        ) : (
          <>
            {/* เลือกเรื่อง — การ์ดแถวเดียว เลื่อนข้างได้ในกรอบ (ไม่ทำให้ทั้งหน้าล้นจอ) */}
            <nav aria-label="เลือกนิยาย" className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide">
              {novels.map((n) => (
                <Link
                  key={n.novel_id}
                  href={href(n.novel_id, days)}
                  aria-current={n.novel_id === selectedId ? "page" : undefined}
                  className={cn(
                    "min-w-[180px] max-w-[240px] shrink-0 rounded-card border px-3 py-2.5 transition-colors",
                    n.novel_id === selectedId ? "border-primary-400 bg-primary-50" : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <p className="line-clamp-1 text-sm font-medium text-neutral-900">{n.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {n.views.toLocaleString("th-TH")} วิว · 7 วัน +{n.views_7d.toLocaleString("th-TH")}
                  </p>
                </Link>
              ))}
            </nav>

            {stats && (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="line-clamp-1 text-lg font-semibold text-neutral-900">{stats.novel.title}</h2>
                  <div role="group" aria-label="ช่วงเวลา" className="inline-flex rounded-pill border border-neutral-200 p-0.5">
                    {RANGES.map((d) => (
                      <Link
                        key={d}
                        href={href(selectedId!, d)}
                        aria-current={d === days ? "true" : undefined}
                        className={cn(
                          "min-h-[36px] rounded-pill px-3.5 py-1.5 text-sm",
                          d === days ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
                        )}
                      >
                        {d} วัน
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  <Tile icon={Eye} label="ยอดเปิดอ่านทั้งหมด" value={stats.totals.views} sub={`${stats.totals.views_in_range.toLocaleString("th-TH")} ใน ${days} วัน`} />
                  <Tile icon={Users} label="ผู้อ่าน" value={stats.totals.readers} sub="คนที่เปิดอ่านอย่างน้อย 1 ตอน" />
                  <Tile icon={Library} label="เพิ่มเข้าชั้น" value={stats.totals.library_adds} />
                  <Tile icon={Heart} label="ถูกใจ" value={stats.totals.likes} />
                  <Tile icon={Star} label="รีวิว" value={stats.totals.reviews} sub={stats.totals.avg_rating !== null ? `เฉลี่ย ${stats.totals.avg_rating} / 5` : "ยังไม่มีคะแนน"} />
                  <Tile icon={MessageCircle} label="คอมเมนต์" value={stats.totals.comments} />
                  <Tile icon={Coins} label="รายได้จากตอน (เหรียญ)" value={stats.totals.chapter_sales_coins} sub={`ขายได้ ${stats.totals.chapter_sales} ครั้ง`} />
                  <Tile icon={Gift} label="ของขวัญ/โดเนท (เหรียญ)" value={stats.totals.gift_coins} />
                </div>

                <div className="mt-6 space-y-6">
                  <DailyViewsChart data={stats.daily_views} />
                  <SentimentPanel sentiment={stats.sentiment} keywords={stats.keywords} />
                  <ChapterTable chapters={stats.chapters} readers={stats.totals.readers} />
                </div>
              </>
            )}
            {!stats && (
              <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">โหลดสถิติไม่สำเร็จ ลองใหม่อีกครั้ง</p>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof BookOpen; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-card border border-neutral-200 p-3 sm:p-4">
      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="line-clamp-1">{label}</span>
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-900 sm:text-2xl">{value.toLocaleString("th-TH")}</p>
      {sub && <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500">{sub}</p>}
    </div>
  );
}
