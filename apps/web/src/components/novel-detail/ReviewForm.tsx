"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** ฟอร์มเขียนรีวิว — POST /api/v1/novels/:novelId/reviews (409 ถ้ารีวิวซ้ำ) */
export function ReviewForm({ novelId }: { novelId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (rating < 1) {
      setError("กรุณาให้คะแนนก่อนส่งรีวิว");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/novels/${novelId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment_text: commentText.trim() || undefined, is_anonymous: isAnonymous }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "ส่งรีวิวไม่สำเร็จ");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-card border border-neutral-200 bg-white p-4 text-sm text-emerald-600">
        ส่งรีวิวของคุณแล้ว ขอบคุณที่แบ่งปันความคิดเห็น
      </div>
    );
  }

  return (
    <div className="rounded-card border border-neutral-200 bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-neutral-800">เขียนรีวิว</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`ให้ ${n} ดาว`}
          >
            <Star
              className={cn(
                "h-6 w-6",
                (hoverRating || rating) >= n ? "fill-amber-400 text-amber-400" : "text-neutral-300"
              )}
            />
          </button>
        ))}
      </div>
      <textarea
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        rows={3}
        placeholder="เล่าความรู้สึกของคุณเกี่ยวกับนิยายเรื่องนี้ (ไม่บังคับ)"
        className="mt-3 w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none"
      />
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-400"
          />
          <EyeOff className="h-3.5 w-3.5" />
          โพสต์แบบไม่ระบุตัวตน
        </label>
        <Button type="button" variant="primary" onClick={handleSubmit} loading={submitting}>
          ส่งรีวิว
        </Button>
      </div>
    </div>
  );
}
