import { Avatar } from "@/components/ui/Avatar";
import { RatingStars } from "@/components/ui/RatingStars";

export interface Review {
  id: string;
  username: string;
  avatarUrl?: string;
  rating: number;
  comment: string;
  daysAgo: number;
}

/** การ์ดรีวิวแนวนอน — ดูแถว "รีวิวจากนักอ่านท่านอื่น" ใน wf_novel_detail.png */
export function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="w-72 shrink-0 rounded-card border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar src={review.avatarUrl} alt={review.username} size="sm" />
          <span className="text-sm font-medium text-neutral-800">{review.username}</span>
        </div>
        <span className="text-xs text-neutral-400">{review.daysAgo} วันที่ผ่านมา</span>
      </div>
      <RatingStars rating={review.rating} className="mt-2" />
      <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{review.comment}</p>
    </div>
  );
}
