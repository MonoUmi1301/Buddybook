"use client";

import { useState } from "react";
import { CHART, formatThaiShortDate } from "@/components/stats/types";

/**
 * ยอดเปิดอ่านรายวัน — ซีรีส์เดียว (ไม่ต้องมี legend ชื่อกราฟบอกแล้ว) แท่งบางมุมบนมน ฐานตรง
 * hover/แตะแท่งไหนก็ได้ = tooltip; มีปุ่มสลับเป็นตาราง (เข้าถึงได้โดยไม่ต้องพึ่งสี/เมาส์)
 * แท่งเป็น flex ทั้งหมด จึงยืดตามความกว้างจอเองทั้ง desktop/iPad/มือถือ
 */
export function DailyViewsChart({ data }: { data: { day: string; views: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.views));
  const total = data.reduce((a, d) => a + d.views, 0);
  const labelEvery = data.length > 31 ? 15 : data.length > 14 ? 7 : 1;

  return (
    <section className="rounded-card border border-neutral-200 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">ยอดเปิดอ่านรายวัน</h2>
          <p className="text-xs text-neutral-500">
            รวม {total.toLocaleString("th-TH")} ครั้งใน {data.length} วัน (ผู้อ่านคนเดิมนับวันละครั้งต่อตอน)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="text-xs font-medium text-primary-600 hover:underline"
        >
          {asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs text-neutral-500">
              <tr>
                <th className="py-1 font-medium">วันที่</th>
                <th className="py-1 text-right font-medium">ยอดเปิดอ่าน</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-neutral-100">
                  <td className="py-1 text-neutral-700">{formatThaiShortDate(d.day)}</td>
                  <td className="py-1 text-right tabular-nums text-neutral-900">{d.views.toLocaleString("th-TH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <div className="flex h-44 items-end gap-[2px] border-b border-neutral-200 sm:h-56" onMouseLeave={() => setActive(null)}>
            {data.map((d, i) => (
              <button
                key={d.day}
                type="button"
                aria-label={`${formatThaiShortDate(d.day)}: ${d.views} ครั้ง`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className="group relative flex h-full min-w-0 flex-1 items-end focus:outline-none"
              >
                <span
                  className="block w-full rounded-t-[4px] transition-opacity"
                  style={{
                    height: d.views === 0 ? 0 : `${Math.max(2, (d.views / max) * 100)}%`,
                    backgroundColor: CHART.single,
                    opacity: active === null || active === i ? 1 : 0.45,
                  }}
                />
              </button>
            ))}
          </div>
          {active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
              style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
            >
              {formatThaiShortDate(data[active].day)} · <strong className="tabular-nums">{data[active].views.toLocaleString("th-TH")}</strong> ครั้ง
            </div>
          )}
          <div className="mt-1.5 flex text-[11px] text-neutral-500">
            {data.map((d, i) => (
              <span key={d.day} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
                {i % labelEvery === 0 || i === data.length - 1 ? formatThaiShortDate(d.day) : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
