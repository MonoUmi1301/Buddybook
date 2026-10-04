import { CHART, type NovelStats } from "@/components/stats/types";

/**
 * ตารางรายตอน — "ผู้อ่านที่ไปถึงตอนนี้" = จำนวนผู้อ่านที่อ่านล่าสุดถึงตอนนี้หรือไกลกว่า (บอกว่าคนเลิกอ่านตอนไหน)
 * desktop/iPad: ตารางเต็ม / มือถือ: การ์ดเรียงลงมา (ไม่ต้องเลื่อนข้างอ่านตาราง)
 */
export function ChapterTable({ chapters, readers }: { chapters: NovelStats["chapters"]; readers: number }) {
  if (chapters.length === 0) {
    return <p className="rounded-card border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-400">ยังไม่มีตอน</p>;
  }
  return (
    <section className="rounded-card border border-neutral-200">
      <div className="p-4 pb-2 sm:p-5 sm:pb-2">
        <h2 className="text-base font-semibold text-neutral-900">สถิติรายตอน</h2>
        <p className="text-xs text-neutral-500">ดูว่าผู้อ่านหยุดอ่านที่ตอนไหน เพื่อปรับจังหวะเรื่อง</p>
      </div>
      <ul className="divide-y divide-neutral-100 sm:hidden">
        {chapters.map((c) => {
          const pct = readers > 0 ? (c.readers_reached / readers) * 100 : 0;
          return (
            <li key={c.chapter_id} className="px-4 py-3">
              <p className="line-clamp-1 text-sm text-neutral-800">
                <span className="mr-1.5 tabular-nums text-neutral-400">{c.chapter_number}.</span>
                {c.title}
                {c.status !== "published" && <span className="ml-1.5 text-[11px] text-neutral-400">({c.status === "draft" ? "ร่าง" : c.status})</span>}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART.single }} />
                </div>
                <span className="text-xs tabular-nums text-neutral-600">
                  ถึงตอนนี้ {c.readers_reached} คน ({Math.round(pct)}%)
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                เปิดอ่าน <span className="tabular-nums text-neutral-800">{c.views.toLocaleString("th-TH")}</span> · คอมเมนต์{" "}
                <span className="tabular-nums text-neutral-800">{c.comments}</span> · ขาย <span className="tabular-nums text-neutral-800">{c.purchases}</span>
              </p>
            </li>
          );
        })}
      </ul>
      <div className="overflow-x-auto max-sm:hidden">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr className="border-b border-neutral-100">
              <th className="px-4 py-2 font-medium sm:px-5">ตอน</th>
              <th className="px-2 py-2 text-right font-medium">เปิดอ่าน</th>
              <th className="w-[34%] px-2 py-2 font-medium">ผู้อ่านที่ไปถึงตอนนี้</th>
              <th className="px-2 py-2 text-right font-medium">คอมเมนต์</th>
              <th className="px-4 py-2 text-right font-medium sm:px-5">ขาย</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((c) => {
              const pct = readers > 0 ? (c.readers_reached / readers) * 100 : 0;
              return (
                <tr key={c.chapter_id} className="border-b border-neutral-100 last:border-0">
                  <td className="max-w-[220px] px-4 py-2 sm:px-5">
                    <span className="mr-1.5 tabular-nums text-neutral-400">{c.chapter_number}.</span>
                    <span className="text-neutral-800">{c.title}</span>
                    {c.status !== "published" && <span className="ml-1.5 text-[11px] text-neutral-400">({c.status === "draft" ? "ร่าง" : c.status})</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-neutral-900">{c.views.toLocaleString("th-TH")}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART.single }} />
                      </div>
                      <span className="w-16 text-right text-xs tabular-nums text-neutral-600">
                        {c.readers_reached} ({Math.round(pct)}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-neutral-700">{c.comments}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-700 sm:px-5">{c.purchases}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
