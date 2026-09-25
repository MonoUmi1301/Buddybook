"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, BookPlus, Check, Eye, Heart, Star, Type } from "lucide-react";
import { ShareButton } from "@/components/ui/ShareButton";
import { GiftButton } from "@/components/gifts/GiftButton";
import { cn } from "@/lib/cn";
import { getPenName } from "@/lib/displayName";
import { formatCompactNumber } from "@/lib/format";
import {
  contentRatingClasses,
  contentRatingLabel,
  legalStatusLabel,
  novelStatusClasses,
  novelStatusLabel,
  type ContentRating,
  type LegalStatus,
  type NovelStatus,
} from "@/lib/novelLabels";

export interface NovelDetailData {
  novel_id: string;
  title: string;
  synopsis: string | null;
  cover_image_url: string | null;
  status: NovelStatus;
  legal_status: LegalStatus;
  content_rating: ContentRating;
  view_count: number;
  created_at: string;
  allow_donations: boolean;
  author: { user_id: string; username: string; pen_name: string | null; avatar_url: string | null };
  primary_tag: { tag_id: number; name: string } | null;
  secondary_tag: { tag_id: number; name: string } | null;
  tags: { tag_id: number; name: string; category: string | null }[];
  character_nodes: {
    node_id: string;
    character_name: string;
    avatar_url: string | null;
    character_role: "protagonist" | "antagonist" | "supporting" | null;
  }[];
  like_count: number;
  is_liked: boolean;
  // เพิ่มภายหลัง (audit fix) — ผู้เขียนซ่อนตัวเลขจำนวนหัวใจได้ ยังกดถูกใจได้ปกติ แค่ไม่โชว์ตัวเลข
  hide_like_count: boolean;
}

export interface NovelHeroStats {
  averageRating: number;
  reviewCount: number;
  chapterCount: number;
  totalCharacters: number;
}

interface NovelHeroProps {
  novel: NovelDetailData;
  stats: NovelHeroStats;
  /** ต่อกับ GET /novels/:id + user library ฝั่ง server */
  initialInLibrary?: boolean;
  isLoggedIn: boolean;
  /** ผู้ใช้ที่ล็อกอิน (null = ยังไม่ล็อกอิน) — ใช้กับปุ่มส่งของขวัญ */
  viewer?: { user_id: string; name: string } | null;
  firstChapterId?: string;
}

function StatCell({ label, icon: Icon, children }: { label: string; icon: typeof Eye; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-neutral-900">
        <Icon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        {children}
      </dd>
    </div>
  );
}

/** หัวหน้ารายละเอียดนิยาย — ปก + ชื่อเรื่อง + แท็ก + กล่องสถิติ + ปุ่ม action
 *  "เพิ่มเข้าชั้น" ต่อกับ POST/DELETE /library, "ถูกใจ" ต่อกับ POST/DELETE /novels/:id/like จริง */
export function NovelHero({ novel, stats, initialInLibrary = false, isLoggedIn, viewer = null, firstChapterId }: NovelHeroProps) {
  const [liked, setLiked] = useState(novel.is_liked);
  const [likeCount, setLikeCount] = useState(novel.like_count);
  const [likingInFlight, setLikingInFlight] = useState(false);
  const [saved, setSaved] = useState(initialInLibrary);
  const [savingLibrary, setSavingLibrary] = useState(false);

  async function toggleLike() {
    if (!isLoggedIn || likingInFlight) return;
    setLikingInFlight(true);
    const nextLiked = !liked;
    try {
      const res = await fetch(`/api/v1/novels/${novel.novel_id}/like`, { method: nextLiked ? "POST" : "DELETE" });
      if (res.ok) {
        const json = (await res.json()) as { liked: boolean; like_count: number };
        setLiked(json.liked);
        setLikeCount(json.like_count);
      }
    } finally {
      setLikingInFlight(false);
    }
  }

  async function toggleLibrary() {
    if (!isLoggedIn || savingLibrary) return;
    setSavingLibrary(true);
    try {
      if (saved) {
        const res = await fetch(`/api/v1/library/${novel.novel_id}`, { method: "DELETE" });
        if (res.ok || res.status === 204) setSaved(false);
      } else {
        const res = await fetch("/api/v1/library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ novel_id: novel.novel_id }),
        });
        if (res.ok || res.status === 409) setSaved(true);
      }
    } finally {
      setSavingLibrary(false);
    }
  }

  // หมวดหมู่หลัก/รองขึ้นก่อน (เน้นสีแบรนด์) ตามด้วยแท็กทั่วไป — กันชื่อซ้ำถ้าแท็กเดียวกันอยู่ทั้งสองที่
  const genreTags = [novel.primary_tag, novel.secondary_tag].filter((t): t is { tag_id: number; name: string } => !!t);
  const genreIds = new Set(genreTags.map((t) => t.tag_id));
  const otherTags = novel.tags.filter((t) => !genreIds.has(t.tag_id));

  return (
    <section className="flex flex-col gap-6 sm:flex-row sm:gap-8">
      <div className="relative mx-auto aspect-[3/4] w-44 shrink-0 overflow-hidden rounded-card bg-gradient-to-br from-brand-tan/40 to-primary-200/60 shadow-lg ring-1 ring-black/5 sm:mx-0 sm:w-48 lg:w-52">
        {novel.cover_image_url ? (
          <Image
            src={novel.cover_image_url}
            alt={`ปกนิยาย ${novel.title}`}
            fill
            priority
            sizes="(min-width: 1024px) 208px, 192px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-12 w-12 text-brand-brown/40" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className={cn("rounded-pill px-2.5 py-0.5 ring-1 ring-inset", novelStatusClasses[novel.status])}>
            {novelStatusLabel[novel.status]}
          </span>
          <span className="rounded-pill bg-brand-tan/15 px-2.5 py-0.5 text-brand-brown ring-1 ring-inset ring-brand-tan/40 dark:text-brand-tan">
            {legalStatusLabel[novel.legal_status]}
          </span>
          <span className={cn("rounded-pill px-2.5 py-0.5 ring-1 ring-inset", contentRatingClasses[novel.content_rating])}>
            {contentRatingLabel[novel.content_rating]}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-bold leading-tight text-neutral-900 sm:text-h2">{novel.title}</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          โดย{" "}
          <Link
            href={`/profile/${novel.author.user_id}`}
            className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            {getPenName(novel.author)}
          </Link>
        </p>

        {(genreTags.length > 0 || otherTags.length > 0) && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="แท็ก">
            {genreTags.map((t) => (
              <li key={`g-${t.tag_id}`}>
                <Link
                  href={`/search?genre_ids=${t.tag_id}`}
                  className="inline-flex rounded-pill bg-primary-500/10 px-2.5 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-500/20 dark:text-primary-300"
                >
                  {t.name}
                </Link>
              </li>
            ))}
            {otherTags.map((t) => (
              <li key={t.tag_id}>
                <Link
                  href={`/search?tag_ids=${t.tag_id}`}
                  className="inline-flex rounded-pill border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 transition-colors hover:border-primary-300 hover:text-primary-600"
                >
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-5 grid grid-cols-2 divide-neutral-100 rounded-card border border-neutral-200 bg-white sm:grid-cols-4 sm:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-neutral-100 sm:[&>*:nth-child(-n+2)]:border-b-0">
          <StatCell label="ยอดวิว" icon={Eye}>
            {formatCompactNumber(novel.view_count)}
          </StatCell>
          <StatCell label="คะแนน" icon={Star}>
            {stats.reviewCount > 0 ? (
              <>
                {stats.averageRating.toFixed(1)}
                <span className="text-sm font-normal text-neutral-400">({stats.reviewCount.toLocaleString()})</span>
              </>
            ) : (
              <span className="text-sm font-normal text-neutral-400">ยังไม่มี</span>
            )}
          </StatCell>
          <StatCell label="จำนวนตอน" icon={BookOpen}>
            {stats.chapterCount.toLocaleString()}
          </StatCell>
          <StatCell label="ตัวอักษร" icon={Type}>
            {formatCompactNumber(stats.totalCharacters)}
          </StatCell>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {firstChapterId ? (
            <Link
              href={`/novels/${novel.novel_id}/chapters/${firstChapterId}`}
              className="inline-flex h-11 min-w-[10rem] flex-1 items-center justify-center gap-2 rounded-pill bg-primary-500 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 sm:max-w-xs"
            >
              <BookOpen className="h-4 w-4" />
              เริ่มอ่านตอนแรก
            </Link>
          ) : (
            <span className="inline-flex h-11 min-w-[10rem] flex-1 cursor-not-allowed items-center justify-center rounded-pill bg-neutral-200 px-6 text-sm font-medium text-neutral-500 sm:max-w-xs">
              ยังไม่มีตอนให้อ่าน
            </span>
          )}

          {isLoggedIn ? (
            <button
              type="button"
              onClick={toggleLibrary}
              disabled={savingLibrary}
              aria-pressed={saved}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                saved
                  ? "border-primary-300 bg-primary-500/10 text-primary-600"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-primary-300 hover:text-primary-600"
              )}
            >
              {saved ? <Check className="h-4 w-4" /> : <BookPlus className="h-4 w-4" />}
              {saved ? "อยู่ในชั้นแล้ว" : "เพิ่มเข้าชั้น"}
            </button>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-pill border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-600"
            >
              <BookPlus className="h-4 w-4" />
              เพิ่มเข้าชั้น
            </Link>
          )}

          {novel.allow_donations && (
            <GiftButton
              variant="hero"
              viewer={viewer}
              resumeHost
              target={{
                authorId: novel.author.user_id,
                authorName: getPenName(novel.author),
                novelId: novel.novel_id,
                novelTitle: novel.title,
              }}
            />
          )}

          <button
            type="button"
            onClick={isLoggedIn ? toggleLike : undefined}
            disabled={likingInFlight || !isLoggedIn}
            aria-pressed={liked}
            aria-label={liked ? "เลิกถูกใจ" : "ถูกใจ"}
            title={isLoggedIn ? undefined : "เข้าสู่ระบบเพื่อกดถูกใจ"}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-1.5 rounded-pill border text-sm font-medium transition-colors disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
              novel.hide_like_count ? "w-11" : "px-4",
              liked
                ? "border-rose-300 bg-rose-500/10 text-rose-500"
                : "border-neutral-300 bg-white text-neutral-700 hover:border-rose-300 hover:text-rose-500"
            )}
          >
            <Heart className={cn("h-4 w-4", liked && "fill-rose-500")} />
            {!novel.hide_like_count && <span>{formatCompactNumber(likeCount)}</span>}
          </button>

          <ShareButton title={novel.title} />
        </div>
      </div>
    </section>
  );
}
