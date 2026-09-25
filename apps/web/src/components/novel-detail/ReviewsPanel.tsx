"use client";

import { useState } from "react";
import Link from "next/link";
import { PenLine, X } from "lucide-react";
import { ReviewCard, StarRow, type Review } from "@/components/novel-detail/ReviewCard";
import { ReviewForm } from "@/components/novel-detail/ReviewForm";

interface ReviewsPanelProps {
  novelId: string;
  reviews: Review[];
  isLoggedIn: boolean;
}

const PAGE_SIZE = 10;

/** แท็บ "รีวิว" — สรุปคะแนน (ค่าเฉลี่ย + การกระจาย 5→1 ดาว) + ปุ่มเขียนรีวิว + รายการรีวิว
 *  คำนวณจากรีวิวที่ได้จาก GET /novels/:id/reviews ทั้งหมด (ไม่มี endpoint สรุปแยก) */
export function ReviewsPanel({ novelId, reviews, isLoggedIn }: ReviewsPanelProps) {
  const [writing, setWriting] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rated = reviews.filter((r) => r.rating > 0);
  const average = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = rated.filter((r) => Math.round(r.rating) === star).length;
    return { star, count, percent: rated.length ? Math.round((count / rated.length) * 100) : 0 };
  });

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-neutral-200 bg-white p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center sm:w-40">
            <p className="text-5xl font-bold tracking-tight text-neutral-900">
              {rated.length ? average.toFixed(1) : "–"}
            </p>
            <StarRow rating={average} className="mt-2" />
            <p className="mt-1.5 text-xs text-neutral-500">{rated.length.toLocaleString()} คะแนน</p>
          </div>

          <ul className="flex-1 space-y-1.5" aria-label="การกระจายคะแนน">
            {distribution.map((d) => (
              <li key={d.star} className="flex items-center gap-3 text-xs">
                <span className="w-10 shrink-0 text-neutral-500">{d.star} ดาว</span>
                <div className="h-2 flex-1 overflow-hidden rounded-pill bg-neutral-100">
                  <div className="h-full rounded-pill bg-primary-500" style={{ width: `${d.percent}%` }} />
                </div>
                <span className="w-9 shrink-0 text-right tabular-nums text-neutral-500">{d.percent}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          {!isLoggedIn ? (
            <Link
              href="/login"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-pill border border-primary-300 text-sm font-semibold text-primary-600 transition-colors hover:bg-primary-500/5"
            >
              เข้าสู่ระบบเพื่อเขียนรีวิว
            </Link>
          ) : writing ? (
            <div>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setWriting(false)}
                  className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
                >
                  <X className="h-3.5 w-3.5" /> ยกเลิก
                </button>
              </div>
              <ReviewForm novelId={novelId} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setWriting(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-primary-500 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
            >
              <PenLine className="h-4 w-4" />
              เขียนรีวิว
            </button>
          )}
        </div>
      </section>

      {reviews.length === 0 ? (
        <p className="rounded-card border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-400">
          ยังไม่มีรีวิว เป็นคนแรกที่รีวิวนิยายเรื่องนี้สิ!
        </p>
      ) : (
        <>
          {reviews.slice(0, visible).map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
          {reviews.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="w-full rounded-card border border-neutral-200 bg-white py-2.5 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-500/5"
            >
              ดูรีวิวเพิ่มเติม
            </button>
          )}
        </>
      )}
    </div>
  );
}
