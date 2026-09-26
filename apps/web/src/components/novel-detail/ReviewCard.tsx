import { Star } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { formatThaiDate } from "@/lib/format";
import { ReportButton } from "@/components/social/ReportButton";

export interface Review {
  id: string;
  username: string;
  avatarUrl?: string;
  /** 0 = ไม่ได้ให้ดาว (rating เป็น null ใน DB) */
  rating: number;
  comment: string;
  createdAt: string;
  isAnonymous: boolean;
}

export function StarRow({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-label={`${rating} จาก 5 ดาว`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("h-4 w-4", i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-neutral-300")}
          aria-hidden
        />
      ))}
    </div>
  );
}

/** การ์ดรีวิวเต็มความกว้าง — ใช้ในแท็บ "รีวิว" ของหน้ารายละเอียดนิยาย */
export function ReviewCard({ review, isLoggedIn = false }: { review: Review; isLoggedIn?: boolean }) {
  return (
    <article className="rounded-card border border-neutral-200 bg-white p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={review.avatarUrl} alt={review.username} size="md" />
          <div className="min-w-0">
            <p className={cn("truncate text-sm font-semibold", review.isAnonymous ? "text-neutral-500" : "text-neutral-900")}>
              {review.username}
            </p>
            <time dateTime={review.createdAt} className="text-xs text-neutral-400">
              {formatThaiDate(review.createdAt)}
            </time>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {review.rating > 0 && <StarRow rating={review.rating} />}
          <ReportButton targetType="review" targetId={review.id} isLoggedIn={isLoggedIn} variant="icon" />
        </div>
      </header>
      {review.comment && (
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">{review.comment}</p>
      )}
    </article>
  );
}
