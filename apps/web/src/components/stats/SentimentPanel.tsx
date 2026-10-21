"use client";

import { useState } from "react";
import { CHART, formatThaiShortDate, type NovelStats } from "@/components/stats/types";

/**
 * gap 3.5 — สิ่งที่ผู้อ่านพูดถึงเรื่องนี้ (วิเคราะห์ด้วยโมเดล Sentiment ภาษาไทย + ป้ายเป้าหมายจาก NLP worker)
 * ตั้งใจแสดงเฉพาะฝั่งที่เป็นกำลังใจ: ข้อความที่ชอบ, ข้อความที่อินกับเรื่อง/ตัวละคร, ตัวละครที่ถูกพูดถึง, คำที่ผู้อ่านชม
 * จำนวนเชิงลบ/ค่าเฉลี่ยความรู้สึกไม่ถูกส่งมาที่หน้านี้เลย — ดูได้ที่หลังบ้านแอดมิน (/admin/sentiment)
 */
export function SentimentPanel({ feedback }: Pick<NovelStats, "feedback">) {
  const { liked, immersed, pending, characters, keywords, weekly } = feedback;
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const maxWeek = Math.max(1, ...weekly.map((w) => w.liked));

  return (
    <section className="rounded-card border border-neutral-200 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-neutral-900">ผู้อ่านพูดถึงเรื่องนี้</h2>
      <p className="mb-4 text-xs text-neutral-500">
        วิเคราะห์จากคอมเมนต์และรีวิวของผู้อ่านด้วยโมเดล Sentiment Analysis ภาษาไทย
        {pending > 0 && ` · รอวิเคราะห์อีก ${pending.toLocaleString("th-TH")} ข้อความ`}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <div>
            <p className="text-3xl font-semibold tabular-nums text-neutral-900">{liked.toLocaleString("th-TH")}</p>
            <p className="text-sm text-neutral-600">ข้อความที่ผู้อ่านบอกว่าชอบ</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums text-neutral-900">{immersed.toLocaleString("th-TH")}</p>
            <p className="text-sm text-neutral-600">ข้อความที่ผู้อ่านอินกับเรื่องหรือตัวละคร</p>
          </div>
          {characters.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-neutral-600">ตัวละครที่ผู้อ่านพูดถึงบ่อย</p>
              <ul className="flex flex-wrap gap-1.5">
                {characters.map((c) => (
                  <li key={c.name} className="rounded-pill bg-primary-50 px-2.5 py-0.5 text-xs text-primary-700">
                    {c.name} <span className="tabular-nums text-primary-400">×{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {liked === 0 && pending === 0 && (
            <p className="rounded-lg bg-neutral-50 px-3 py-4 text-center text-sm text-neutral-500">
              ยังไม่มีความคิดเห็นจากผู้อ่าน ลองชวนผู้อ่านคอมเมนต์ท้ายตอนดูนะ
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-neutral-800">ข้อความที่ชอบรายสัปดาห์ (8 สัปดาห์ล่าสุด)</h3>
          <div className="relative" onMouseLeave={() => setActiveWeek(null)}>
            <div className="flex h-28 items-end gap-1.5 border-b border-neutral-200">
              {weekly.map((w, i) => (
                <button
                  key={w.week_start}
                  type="button"
                  aria-label={`สัปดาห์ ${formatThaiShortDate(w.week_start)}: ${w.liked} ข้อความ`}
                  onMouseEnter={() => setActiveWeek(i)}
                  onFocus={() => setActiveWeek(i)}
                  onClick={() => setActiveWeek(i)}
                  className="flex h-full min-w-0 flex-1 items-end focus:outline-none"
                >
                  <span
                    className="w-full rounded-t-[4px]"
                    style={{
                      height: `${w.liked === 0 ? 0 : Math.max(4, (w.liked / maxWeek) * 100)}%`,
                      backgroundColor: CHART.positive,
                      opacity: activeWeek === null || activeWeek === i ? 1 : 0.45,
                    }}
                  />
                </button>
              ))}
            </div>
            {activeWeek !== null && (
              <div
                role="status"
                className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
                style={{ left: `${((activeWeek + 0.5) / weekly.length) * 100}%` }}
              >
                เริ่ม {formatThaiShortDate(weekly[activeWeek].week_start)} · <strong className="tabular-nums">{weekly[activeWeek].liked}</strong> ข้อความ
              </div>
            )}
            <div className="mt-1 flex text-[11px] text-neutral-500">
              {weekly.map((w, i) => (
                <span key={w.week_start} className="min-w-0 flex-1 text-center">
                  {i % 2 === 1 || weekly.length <= 4 ? formatThaiShortDate(w.week_start) : ""}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-medium text-neutral-800">คำที่ผู้อ่านชมบ่อย</h3>
            {keywords.length === 0 ? (
              <p className="text-xs text-neutral-400">ยังไม่มีคำที่ถูกพูดถึงซ้ำ</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <li key={k.term} className="rounded-pill border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-700">
                    {k.term} <span className="tabular-nums text-neutral-400">×{k.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
