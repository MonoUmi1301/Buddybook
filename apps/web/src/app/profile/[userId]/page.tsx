import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, Eye, Heart, PawPrint, PenLine, Settings, Star } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShareButton } from "@/components/ui/ShareButton";
import { Tabs } from "@/components/ui/Tabs";
import { ProfileNovelCard, type ProfileNovel } from "@/components/profile/ProfileNovelCard";
import { GiftButton } from "@/components/gifts/GiftButton";
import { ReaderSupportCard } from "@/components/gifts/ReaderSupportCard";
import { SupporterBadges } from "@/components/gifts/SupporterBadges";
import type { PublicGifts, SupporterBadge } from "@/lib/gifts";
import { callApi } from "@/lib/api/proxy";
import { getCurrentUser } from "@/lib/api/session";
import { FollowButton } from "@/components/social/FollowButton";
import { ReportButton } from "@/components/social/ReportButton";
import { getPenName } from "@/lib/displayName";
import { formatCompactNumber, formatThaiMonthYear } from "@/lib/format";

interface PublicProfile {
  user_id: string;
  username: string;
  pen_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  novel_count: number;
  novels: ProfileNovel[];
}

function StatRow({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="flex items-center gap-2 text-sm text-neutral-500">
        <Icon className="h-4 w-4 text-primary-500" aria-hidden />
        {label}
      </dt>
      <dd className="text-base font-semibold tabular-nums text-neutral-900">{value}</dd>
    </div>
  );
}

export default async function ProfilePage({ params }: { params: { userId: string } }) {
  const [user, result] = await Promise.all([
    getCurrentUser(),
    callApi({ method: "GET", path: `/users/${params.userId}` }),
  ]);

  if ("error" in result || result.status === 404) notFound();
  if (result.status !== 200) {
    return (
      <div className="flex min-h-screen flex-col bg-neutral-50">
        <Navbar user={user} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            เชื่อมต่อ API Gateway ไม่ได้ตอนนี้ — ตรวจสอบว่า apps/api (Express) กำลังรันอยู่หรือไม่
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const profile = result.json as PublicProfile;
  const name = getPenName(profile);
  const isOwnProfile = user?.user_id === profile.user_id;
  const isWriter = profile.novel_count > 0;
  const viewer = user ? { user_id: user.user_id, name: getPenName(user) } : null;

  // เพิ่มภายหลัง (Gift donations) — "กำลังใจจากนักอ่าน" (เฉพาะนักเขียน) + ป้ายผู้สนับสนุน (ทุกคน)
  const [supportResult, badgesResult] = await Promise.all([
    isWriter ? callApi({ method: "GET", path: `/authors/${profile.user_id}/gifts/public` }) : Promise.resolve(null),
    callApi({ method: "GET", path: `/users/${profile.user_id}/supporter-badges` }),
  ]);
  const support =
    supportResult && !("error" in supportResult) && supportResult.status === 200 ? (supportResult.json as PublicGifts) : null;
  const badges =
    !("error" in badgesResult) && badgesResult.status === 200 ? (badgesResult.json as { badges: SupporterBadge[] }).badges : [];

  const totalViews = profile.novels.reduce((s, n) => s + n.view_count, 0);
  // นิยายที่นักเขียนซ่อนยอดถูกใจ (like_count = null) ไม่ถูกนับรวม — กันเดาตัวเลขที่ซ่อนไว้จากผลรวม
  const totalLikes = profile.novels.reduce((s, n) => s + (n.like_count ?? 0), 0);
  const totalChapters = profile.novels.reduce((s, n) => s + n.chapter_count, 0);
  const totalReviews = profile.novels.reduce((s, n) => s + n.review_count, 0);
  // ค่าเฉลี่ยถ่วงน้ำหนักตามจำนวนรีวิวของแต่ละเรื่อง (ไม่ใช่เฉลี่ยของค่าเฉลี่ย)
  const averageRating = totalReviews
    ? profile.novels.reduce((s, n) => s + n.rating * n.review_count, 0) / totalReviews
    : 0;
  const joined = formatThaiMonthYear(profile.created_at);

  const worksPanel =
    profile.novels.length === 0 ? (
      <div className="rounded-card border border-dashed border-neutral-300 bg-white py-6">
        <EmptyState
          title={isOwnProfile ? "คุณยังไม่มีผลงานที่เผยแพร่" : "ยังไม่มีผลงานที่เผยแพร่"}
          size="sm"
        />
        {isOwnProfile && (
          <div className="mt-2 flex justify-center">
            <Link
              href="/write"
              className="inline-flex h-10 items-center gap-2 rounded-pill bg-primary-500 px-5 text-sm font-semibold text-white hover:bg-primary-600"
            >
              <PenLine className="h-4 w-4" />
              เริ่มเขียนเรื่องแรก
            </Link>
          </div>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {profile.novels.map((novel) => (
          <ProfileNovelCard key={novel.novel_id} novel={novel} />
        ))}
      </div>
    );

  const aboutPanel = (
    <section className="rounded-card border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-neutral-900">เกี่ยวกับ {name}</h2>
      <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">
        {profile.bio || <span className="text-neutral-400">ยังไม่ได้เขียนแนะนำตัว</span>}
      </p>
      <dl className="mt-6 divide-y divide-neutral-100 border-t border-neutral-100 text-sm">
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-neutral-500">ชื่อผู้ใช้</dt>
          <dd className="font-medium text-neutral-800">@{profile.username}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-neutral-500">เข้าร่วมเมื่อ</dt>
          <dd className="font-medium text-neutral-800">{joined}</dd>
        </div>
      </dl>
    </section>
  );

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <Navbar user={user} />

      <main className="flex-1 pb-12">
        {/* แบนเนอร์ไล่สีโทนแบรนด์ (ส้ม → แทน) — ยังไม่มีคอลัมน์รูปปกโปรไฟล์ใน schema */}
        <div
          className="h-36 bg-gradient-to-r from-primary-300 via-brand-tan to-primary-200 sm:h-44 dark:opacity-70"
          aria-hidden
        >
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_120%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_85%_-20%,rgba(255,255,255,0.3),transparent_40%)]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="-mt-16 flex flex-col items-center gap-4 sm:-mt-20 sm:flex-row sm:items-end sm:gap-6">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full bg-brand-tan/20 shadow-lg ring-4 ring-neutral-50 sm:h-40 sm:w-40">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={name} fill priority sizes="160px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white">
                  <PawPrint className="h-14 w-14 -rotate-12 text-brand-tan-dark" fill="currentColor" aria-hidden />
                </div>
              )}
            </div>

            <div className="w-full min-w-0 flex-1 rounded-card border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <h1 className="truncate text-2xl font-bold text-neutral-900 sm:text-h3">{name}</h1>
                    <span
                      className={
                        isWriter
                          ? "inline-flex items-center gap-1 rounded-pill bg-primary-500 px-2.5 py-0.5 text-xs font-medium text-white"
                          : "inline-flex items-center gap-1 rounded-pill bg-brand-tan/20 px-2.5 py-0.5 text-xs font-medium text-brand-brown dark:text-brand-tan"
                      }
                    >
                      {isWriter ? <PenLine className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                      {isWriter ? "นักเขียน" : "นักอ่าน"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-neutral-500">@{profile.username}</p>
                </div>

                <div className="flex shrink-0 items-center justify-center gap-2">
                  {isOwnProfile && (
                    <Link
                      href="/settings"
                      className="inline-flex h-11 items-center gap-2 rounded-pill border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-600"
                    >
                      <Settings className="h-4 w-4" />
                      แก้ไขโปรไฟล์
                    </Link>
                  )}
                  {isWriter && !isOwnProfile && <FollowButton authorId={profile.user_id} isLoggedIn={Boolean(user)} />}
                  {isWriter && !isOwnProfile && (
                    <GiftButton
                      variant="profile"
                      resumeHost
                      target={{ authorId: profile.user_id, authorName: name }}
                      viewer={viewer}
                    />
                  )}
                  <ShareButton title={name} label="แชร์โปรไฟล์" />
                  {!isOwnProfile && <ReportButton targetType="user" targetId={profile.user_id} isLoggedIn={Boolean(user)} variant="icon" className="px-2" />}
                </div>
              </div>

              {profile.bio && (
                <p className="mt-3 line-clamp-3 text-center text-[15px] leading-relaxed text-neutral-600 sm:text-left">
                  {profile.bio}
                </p>
              )}

              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-neutral-500 sm:justify-start">
                <CalendarDays className="h-4 w-4" aria-hidden />
                เข้าร่วมเมื่อ {joined}
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <section className="rounded-card border border-neutral-200 bg-white px-5 pb-2 pt-5">
                <h2 className="text-base font-semibold text-neutral-900">สถิติ</h2>
                <dl className="mt-1 divide-y divide-neutral-100">
                  <StatRow icon={BookOpen} label="ผลงาน" value={`${profile.novel_count.toLocaleString()} เรื่อง`} />
                  <StatRow icon={PenLine} label="ตอนที่เผยแพร่" value={totalChapters.toLocaleString()} />
                  <StatRow icon={Eye} label="ยอดวิวรวม" value={formatCompactNumber(totalViews)} />
                  <StatRow icon={Heart} label="ถูกใจรวม" value={formatCompactNumber(totalLikes)} />
                  <StatRow
                    icon={Star}
                    label="คะแนนเฉลี่ย"
                    value={totalReviews ? `${averageRating.toFixed(1)} (${totalReviews.toLocaleString()})` : "–"}
                  />
                </dl>
              </section>
              {isWriter && (
                <ReaderSupportCard
                  data={support}
                  viewer={viewer}
                  canSend={!isOwnProfile}
                  target={{ authorId: profile.user_id, authorName: name }}
                />
              )}
              <SupporterBadges badges={badges} />
            </aside>

            <Tabs
              tabs={[
                { id: "works", label: "ผลงาน", count: profile.novel_count, content: worksPanel },
                { id: "about", label: "เกี่ยวกับ", content: aboutPanel },
              ]}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
