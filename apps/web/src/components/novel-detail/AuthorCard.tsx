import Image from "next/image";
import Link from "next/link";
import { PawPrint } from "lucide-react";
import { getPenName } from "@/lib/displayName";
import { formatCompactNumber } from "@/lib/format";
import { FollowButton } from "@/components/social/FollowButton";

interface AuthorCardProps {
  author: { user_id: string; username: string; pen_name: string | null; avatar_url: string | null };
  bio?: string | null;
  novelCount?: number;
  totalViews?: number;
  /** เพิ่มภายหลัง (ติดตามนักเขียน) — ไม่ส่ง viewerId = ไม่ได้ล็อกอิน */
  viewerId?: string;
}

/** การ์ด "เกี่ยวกับนักเขียน" ในแถบข้าง — bio/สถิติมาจาก GET /users/:id (ถ้าดึงไม่สำเร็จจะโชว์แค่ชื่อ+รูป) */
export function AuthorCard({ author, bio, novelCount, totalViews, viewerId }: AuthorCardProps) {
  const name = getPenName(author);
  const profileHref = `/profile/${author.user_id}`;

  return (
    <section className="rounded-card border border-neutral-200 bg-white p-5">
      <h2 className="text-base font-semibold text-neutral-900">เกี่ยวกับนักเขียน</h2>

      <Link href={profileHref} className="group mt-4 flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-brand-tan/20 ring-2 ring-primary-500/20">
          {author.avatar_url ? (
            <Image src={author.avatar_url} alt={name} fill sizes="56px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <PawPrint className="h-6 w-6 -rotate-12 text-brand-tan-dark" fill="currentColor" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900 group-hover:text-primary-600">{name}</p>
          {novelCount !== undefined && (
            <p className="text-xs text-neutral-500">
              ผลงาน {novelCount.toLocaleString()} เรื่อง
              {totalViews !== undefined && totalViews > 0 && <> · ยอดวิวรวม {formatCompactNumber(totalViews)}</>}
            </p>
          )}
        </div>
      </Link>

      {bio && <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-neutral-600">{bio}</p>}

      {viewerId !== author.user_id && (
        <FollowButton authorId={author.user_id} isLoggedIn={Boolean(viewerId)} className="mt-4 h-10 w-full" />
      )}

      <Link
        href={profileHref}
        className="mt-3 flex h-10 w-full items-center justify-center rounded-pill border border-neutral-300 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-600"
      >
        ดูโปรไฟล์นักเขียน
      </Link>
    </section>
  );
}
