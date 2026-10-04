"use client";

import { useState } from "react";
import { CHART, formatThaiShortDate, type KeywordCount, type NovelStats } from "@/components/stats/types";

const LABELS = { pos: "เชิงบวก", neutral: "เป็นกลาง", neg: "เชิงลบ" } as const;

function polarityText(p: number | null): string {
  if (p === null) return "ยังไม่มีข้อมูล";
  if (p >= 0.3) return "ผู้อ่านส่วนใหญ่ชอบ";
  if (p <= -0.3) return "ผู้อ่านส่วนใหญ่ไม่พอใจ";
  return "ความเห็นค่อนข้างผสม";
}

/**
 * gap 3.5 — Social listening ภายในแพลตฟอร์ม: ผู้อ่านรู้สึกอย่างไรกับเรื่องนี้ และพูดถึงอะไร
 * สัดส่วน = แถบซ้อน 3 ส่วน (บวก/กลาง/ลบ) พร้อมป้ายตัวเลข (ไม่พึ่งสีอย่างเดียว)
 * แนวโน้มรายสัปดาห์ = แท่งสองทิศจากเส้นศูนย์ (บวกขึ้น/ลบลง) สเกลคงที่ −1..1
 */
export function SentimentPanel({ sentiment, keywords }: Pick<NovelStats, "sentiment" | "keywords">) {
  const { counts, avg_polarity, weekly } = sentiment;
  const analysed = counts.pos + counts.neutral + counts.neg;
  const [activeWeek, setActiveWeek] = useState<number | null>(null);

  return (
    <section className="rounded-card border border-neutral-200 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-neutral-900">ผู้อ่านรู้สึกอย่างไร</h2>
      <p className="mb-4 text-xs text-neutral-500">
        วิเคราะห์จากคอมเมนต์และรีวิวของผู้อ่านด้วยโมเดล Sentiment Analysis ภาษาไทย
        {counts.pending > 0 && ` · รอวิเคราะห์อีก ${counts.pending} ข้อความ`}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <p className="text-3xl font-semibold tabular-nums text-neutral-900">
            {avg_polarity === null ? "–" : `${avg_polarity > 0 ? "+" : ""}${avg_polarity.toFixed(2)}`}
          </p>
          <p className="text-sm text-neutral-600">{polarityText(avg_polarity)}</p>
          <p className="mt-0.5 text-xs text-neutral-500">คะแนนความรู้สึกเฉลี่ย (−1 ไม่ชอบมาก ถึง +1 ชอบมาก)</p>

          {analysed > 0 ? (
            <>
              <div className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
                {(["pos", "neutral", "neg"] as const).map((k) =>
                  counts[k] > 0 ? (
                    <span
                      key={k}
                      style={{ width: `${(counts[k] / analysed) * 100}%`, backgroundColor: k === "pos" ? CHART.positive : k === "neg" ? CHART.negative : CHART.neutral }}
                    />
                  ) : null
                )}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {(["pos", "neutral", "neg"] as const).map((k) => (
                  <li key={k} className="flex items-center gap-2 text-neutral-700">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: k === "pos" ? CHART.positive : k === "neg" ? CHART.negative : CHART.neutral }}
                    />
                    <span className="flex-1">{LABELS[k]}</span>
                    <span className="tabular-nums text-neutral-900">{counts[k].toLocaleString("th-TH")}</span>
                    <span className="w-12 text-right tabular-nums text-neutral-500">{Math.round((counts[k] / analysed) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-4 text-center text-sm text-neutral-500">ยังไม่มีคอมเมนต์ที่วิเคราะห์แล้ว</p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-neutral-800">แนวโน้มรายสัปดาห์ (8 สัปดาห์ล่าสุด)</h3>
          <div className="relative" onMouseLeave={() => setActiveWeek(null)}>
            <div className="flex h-32 gap-1.5">
              {weekly.map((w, i) => {
                const p = w.avg_polarity;
                const h = p === null ? 0 : Math.abs(p) * 50;
                return (
                  <button
                    key={w.week_start}
                    type="button"
                    aria-label={`สัปดาห์ ${formatThaiShortDate(w.week_start)}: ${p === null ? "ไม่มีข้อมูล" : p.toFixed(2)} (${w.count} ข้อความ)`}
                    onMouseEnter={() => setActiveWeek(i)}
                    onFocus={() => setActiveWeek(i)}
                    onClick={() => setActiveWeek(i)}
                    className="relative min-w-0 flex-1 focus:outline-none"
                  >
                    <span className="absolute inset-x-0 top-1/2 border-t border-neutral-300" />
                    {p !== null && (
                      <span
                        className={p >= 0 ? "absolute inset-x-0 rounded-t-[4px]" : "absolute inset-x-0 rounded-b-[4px]"}
                        style={{
                          height: `${Math.max(2, h)}%`,
                          ...(p >= 0 ? { bottom: "50%" } : { top: "50%" }),
                          backgroundColor: p >= 0 ? CHART.positive : CHART.negative,
                          opacity: activeWeek === null || activeWeek === i ? 1 : 0.45,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {activeWeek !== null && (
              <div
                role="status"
                className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
                style={{ left: `${((activeWeek + 0.5) / weekly.length) * 100}%` }}
              >
                เริ่ม {formatThaiShortDate(weekly[activeWeek].week_start)} ·{" "}
                {weekly[activeWeek].avg_polarity === null ? "ไม่มีข้อมูล" : <strong className="tabular-nums">{weekly[activeWeek].avg_polarity!.toFixed(2)}</strong>}{" "}
                ({weekly[activeWeek].count} ข้อความ)
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

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <KeywordList title="คำที่พูดถึงในแง่บวก" items={keywords.positive} tone="pos" />
            <KeywordList title="คำที่พูดถึงในแง่ลบ" items={keywords.negative} tone="neg" />
          </div>
        </div>
      </div>
    </section>
  );
}

function KeywordList({ title, items, tone }: { title: string; items: KeywordCount[]; tone: "pos" | "neg" }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-neutral-800">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: tone === "pos" ? CHART.positive : CHART.negative }} />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-neutral-400">ยังไม่มีคำที่ถูกพูดถึงซ้ำ</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((k) => (
            <li key={k.term} className="rounded-pill border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-700">
              {k.term} <span className="tabular-nums text-neutral-400">×{k.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
