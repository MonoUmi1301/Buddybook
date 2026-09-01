"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookPlus, Eye, Heart, Share2 } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Tag, type TagColor } from "@/components/ui/Tag";
import { StatPill } from "@/components/ui/StatPill";
import { cn } from "@/lib/cn";
import { getPenName } from "@/lib/displayName";

export interface NovelDetailData {
  novel_id: string;
  title: string;
  synopsis: string | null;
  cover_image_url: string | null;
  status: "ongoing" | "completed" | "hiatus";
  legal_status: "original" | "fan-fiction" | "translation";
  content_rating: "all_ages" | "teen" | "mature";
  view_count: number;
  author: { user_id: string; username: string; pen_name: string | null; avatar_url: string | null };
  tags: { tag_id: number; name: string; category: string | null }[];
  character_nodes: {
    node_id: string;
    character_name: string;
    avatar_url: string | null;
    character_role: "protagonist" | "antagonist" | "supporting" | null;
  }[];
  like_count: number;
  is_liked: boolean;
}

const legalStatusLabel: Record<NovelDetailData["legal_status"], string> = {
  original: "ต้นฉบับ",
  "fan-fiction": "แฟนฟิค",
  translation: "แปล",
};

const contentRatingLabel: Record<NovelDetailData["content_rating"], string> = {
  all_ages: "ทุกวัย",
  teen: "13+",
  mature: "18+",
};

const tagPalette: TagColor[] = ["rose", "teal", "violet", "amber", "emerald", "sky"];

interface NovelHeroProps {
  novel: NovelDetailData;
  /** ต่อกับ GET /novels/:id + user library ฝั่ง server — undefined = ยังไม่ได้ล็อกอิน (ซ่อนปุ่ม) */
  initialInLibrary?: boolean;
  isLoggedIn: boolean;
  firstChapterId?: string;
}

/** แบนเนอร์หัวเรื่องนิยาย — ต่อกับ GET /novels/:novel_id จริง ดู wf_novel_detail.png
 *  "เพิ่มเข้าชั้น" ต่อกับ POST/DELETE /library, "ถูกใจ" ต่อกับ POST/DELETE /novels/:id/like จริงแล้ว
 *  (เพิ่มตาราง NovelLike ภายหลัง audit pass — เดิมเป็นแค่ local UI state ไม่บันทึกอะไรเลย) */
export function NovelHero({ novel, initialInLibrary = false, isLoggedIn, firstChapterId }: NovelHeroProps) {
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

  return (
    <div className="bg-black">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <BackButton variant="dark" />
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:grid-cols-[220px_1fr] lg:px-8">
        <div className="relative mx-auto aspect-[3/4] w-48 shrink-0 overflow-hidden rounded-card bg-neutral-800 md:mx-0 md:w-full">
          {novel.cover_image_url && (
            <Image src={novel.cover_image_url} alt={novel.title} fill sizes="220px" className="object-cover" />
          )}
        </div>

        <div className="flex flex-col justify-center text-white">
          <div className="mb-1 flex items-center gap-2 text-sm">
            <span className="font-medium text-primary-400">{legalStatusLabel[novel.legal_status]}</span>
            <Tag color={novel.content_rating === "mature" ? "red" : novel.content_rating === "teen" ? "amber" : "slate"}>
              {contentRatingLabel[novel.content_rating]}
            </Tag>
          </div>
          <h1 className="text-h2 text-white">{novel.title}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              href={`/profile/${novel.author.user_id}`}
              className="text-sm text-neutral-300 hover:text-white hover:underline"
            >
              {getPenName(novel.author)}
            </Link>
            {novel.tags.slice(0, 3).map((t, i) => (
              <Tag key={t.tag_id} color={tagPalette[i % tagPalette.length]}>
                {t.name}
              </Tag>
            ))}
          </div>

          {novel.synopsis && (
            <p className="mt-3 line-clamp-3 max-w-2xl text-sm text-neutral-400">{novel.synopsis}</p>
          )}

          <div className="mt-4 flex items-center gap-4">
            <StatPill icon={Eye} value={novel.view_count} className="text-sm" />
            <StatPill icon={Heart} value={likeCount} className="text-sm" iconClassName="text-rose-400" />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleLike}
              disabled={likingInFlight}
              aria-pressed={liked}
              aria-label="ถูกใจ"
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full border transition-colors",
                liked
                  ? "border-rose-500 bg-rose-500/10 text-rose-500"
                  : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
              )}
            >
              <Heart className={cn("h-5 w-5", liked && "fill-rose-500")} />
            </button>

            {isLoggedIn && (
              <Button
                type="button"
                variant="outline-dark"
                size="lg"
                onClick={toggleLibrary}
                disabled={savingLibrary}
                className={cn(saved && "border-primary-400 text-primary-400")}
              >
                <BookPlus className="h-4 w-4" />
                {saved ? "เพิ่มแล้ว" : "เพิ่มเข้าชั้น"}
              </Button>
            )}

            {firstChapterId ? (
              <Link href={`/novels/${novel.novel_id}/chapters/${firstChapterId}`}>
                <Button type="button" variant="primary" size="lg">
                  อ่านเลย
                </Button>
              </Link>
            ) : (
              <Button type="button" variant="primary" size="lg" disabled>
                ยังไม่มีตอนให้อ่าน
              </Button>
            )}

            <button
              type="button"
              aria-label="แชร์"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-700 text-neutral-300 transition-colors hover:border-neutral-500"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
