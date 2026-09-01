import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

interface RatingStarsProps {
  /** 0-5 */
  rating: number;
  reviewCount?: number;
  size?: "sm" | "md";
  className?: string;
}

export function RatingStars({ rating, reviewCount, size = "sm", className }: RatingStarsProps) {
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  const rounded = Math.round(rating);

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(starSize, i < rounded ? "fill-amber-400 text-amber-400" : "text-neutral-600")}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-neutral-400">
        {rating.toFixed(1)}
        {reviewCount !== undefined && ` (${reviewCount})`}
      </span>
    </div>
  );
}
