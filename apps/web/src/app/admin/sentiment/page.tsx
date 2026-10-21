import Link from "next/link";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { CHART } from "@/components/stats/types";

type Label = "pos" | "neutral" | "neg";
interface SentimentOverview {
  counts: Record<Label | "pending", number>;
  avg_polarity: number | null;
  targets: Record<string, Record<Label, number>>;
  weekly: { week_start: string; count: number; neg: number; avg_polarity: number | null }[];
  novels_needing_attention: {
    novel_id: string;
    title: string;
    author: string;
    analysed: number;
    neg: number;
    neg_share: number | null;
    work_neg: number;
    avg_polarity: number | null;
  }[];
}

const LABEL: Record<Label, string> = { pos: "เชิงบวก", neutral: "เป็นกลาง", neg: "เชิงลบ" };
const COLOR: Record<Label, string> = { pos: CHART.positive, neutral: CHART.neutral, neg: CHART.negative };
const TARGET: Record<string, string> = {
  character: "พูดถึงตัวละคร",
  immersion: "อินกับเหตุการณ์",
  work: "พูดถึงงานเขียน",
  none: "ไม่ระบุ / ยังไม่มีป้าย",
};
const fmt = (n: number) => n.toLocaleString("th-TH");
const signed = (p: number | null) => (p === null ? "–" : `${p > 0 ? "+" : ""}${p.toFixed(2)}`);
const thaiDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

/** หลังบ้าน — ความรู้สึกผู้อ่านทั้งแพลตฟอร์ม รวมฝั่งเชิงลบที่ตั้งใจไม่แสดงในหน้าสถิติของนักเขียน */
export default async function AdminSentimentPage() {
  const result = await callApi({ method: "GET", path: "/admin/reports/sentiment", token: getAccessToken() });
  if ("error" in result || result.status !== 200) {
    return <p className="rounded-card border border-neutral-200 p-5 text-sm text-neutral-500">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>;
  }
  const data = result.json as SentimentOverview;
  const analysed = data.counts.pos + data.counts.neutral + data.counts.neg;
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");
  const targetKeys = ["character", "immersion", "work", "none"].filter((k) => data.targets[k]);

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ข้อมูลหน้านี้ใช้ภายในเท่านั้น หน้าสถิติของนักเขียนแสดงเฉพาะข้อความที่ผู้อ่านชอบและอินกับเรื่อง ไม่แสดงตัวเลขเชิงลบ
      </div>

      <section className="rounded-card border border-neutral-200 p-5">
        <h2 className="text-base font-semibold text-neutral-900">ความรู้สึกของผู้อ่านทั้งแพลตฟอร์ม</h2>
        <p className="mb-4 text-xs text-neutral-500">
          คอมเมนต์และรีวิวของผู้อ่าน (ไม่นับข้อความของนักเขียนบนนิยายตัวเอง) · วิเคราะห์แล้ว {fmt(analysed)} ข้อความ
          {data.counts.pending > 0 && ` · รอวิเคราะห์ ${fmt(data.counts.pending)}`}
        </p>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <p className="text-3xl font-semibold tabular-nums text-neutral-900">{signed(data.avg_polarity)}</p>
            <p className="text-xs text-neutral-500">คะแนนความรู้สึกเฉลี่ย (−1 ถึง +1)</p>
          </div>
          <div>
            {analysed > 0 && (
              <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
                {(["pos", "neutral", "neg"] as const).map((k) =>
                  data.counts[k] > 0 ? <span key={k} style={{ width: `${(data.counts[k] / analysed) * 100}%`, backgroundColor: COLOR[k] }} /> : null
                )}
              </div>
            )}
            <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-3">
              {(["pos", "neutral", "neg"] as const).map((k) => (
                <li key={k} className="flex items-center gap-2 text-neutral-700">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLOR[k] }} />
                  <span className="flex-1">{LABEL[k]}</span>
                  <span className="tabular-nums text-neutral-900">{fmt(data.counts[k])}</span>
                  <span className="w-10 text-right tabular-nums text-neutral-500">{pct(data.counts[k], analysed)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-neutral-200 p-5">
          <h2 className="text-base font-semibold text-neutral-900">ความรู้สึกพุ่งไปที่อะไร</h2>
          <p className="mb-3 text-xs text-neutral-500">ป้ายจากกฎแยกเป้าหมาย (target.py) — ไม่เปลี่ยนผลบวก/ลบของโมเดล</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="py-1.5 font-medium">ป้าย</th>
                  {(["pos", "neutral", "neg"] as const).map((k) => (
                    <th key={k} className="py-1.5 text-right font-medium">{LABEL[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {targetKeys.map((k) => (
                  <tr key={k} className="border-t border-neutral-100">
                    <td className="py-1.5 text-neutral-700">{TARGET[k] ?? k}</td>
                    {(["pos", "neutral", "neg"] as const).map((l) => (
                      <td key={l} className="py-1.5 text-right tabular-nums text-neutral-900">{fmt(data.targets[k][l])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-card border border-neutral-200 p-5">
          <h2 className="text-base font-semibold text-neutral-900">รายสัปดาห์ (ย้อนหลัง 8 สัปดาห์)</h2>
          <p className="mb-3 text-xs text-neutral-500">จำนวนข้อความ · สัดส่วนเชิงลบ · คะแนนเฉลี่ย</p>
          <ul className="space-y-1.5 text-sm">
            {data.weekly.map((w) => (
              <li key={w.week_start} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-neutral-500">{thaiDate(w.week_start)}</span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(w.neg, w.count), backgroundColor: CHART.negative }} />
                </span>
                <span className="w-14 text-right tabular-nums text-neutral-700">{fmt(w.count)}</span>
                <span className="w-10 text-right tabular-nums text-neutral-500">{pct(w.neg, w.count)}</span>
                <span className="w-12 text-right tabular-nums text-neutral-900">{signed(w.avg_polarity)}</span>
              </li>
            ))}
            {data.weekly.length === 0 && <li className="text-xs text-neutral-400">ยังไม่มีข้อมูล</li>}
          </ul>
        </section>
      </div>

      <section className="rounded-card border border-neutral-200 p-5">
        <h2 className="text-base font-semibold text-neutral-900">นิยายที่ผู้อ่านไม่ค่อยพอใจ</h2>
        <p className="mb-3 text-xs text-neutral-500">
          อย่างน้อย 5 ข้อความที่วิเคราะห์แล้ว เรียงจากสัดส่วนเชิงลบมากสุด · "ติงานเขียน" = เชิงลบที่ถูกติดป้ายว่าพูดถึงงานเขียน
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="py-1.5 font-medium">นิยาย</th>
                <th className="py-1.5 text-right font-medium">ข้อความ</th>
                <th className="py-1.5 text-right font-medium">เชิงลบ</th>
                <th className="py-1.5 text-right font-medium">ติงานเขียน</th>
                <th className="py-1.5 text-right font-medium">คะแนนเฉลี่ย</th>
              </tr>
            </thead>
            <tbody>
              {data.novels_needing_attention.map((n) => (
                <tr key={n.novel_id} className="border-t border-neutral-100">
                  <td className="py-2">
                    <Link href={`/novels/${n.novel_id}`} className="font-medium text-neutral-900 hover:underline">{n.title}</Link>
                    <span className="block text-xs text-neutral-500">{n.author}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmt(n.analysed)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {fmt(n.neg)} <span className="text-neutral-500">({pct(n.neg, n.analysed)})</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmt(n.work_neg)}</td>
                  <td className="py-2 text-right tabular-nums">{signed(n.avg_polarity)}</td>
                </tr>
              ))}
              {data.novels_needing_attention.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs text-neutral-400">ยังไม่มีนิยายที่เข้าเกณฑ์</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
