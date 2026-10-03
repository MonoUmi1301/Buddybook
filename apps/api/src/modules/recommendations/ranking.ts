/**
 * Recommendation v2 — ส่วนจัดอันดับแบบ pure function (ไม่แตะ DB) ใช้ร่วมกันโดย
 * recommendations.service.ts (ของจริง) และ scripts/eval-recs.ts (วัด KPI-1/KPI-2 บน mock data)
 *
 * ขั้นตอน (gap 2.3):
 *   1. candidate จากหลายแหล่ง — interest (แท็กที่สนใจ), similar_readers (collaborative + sentiment),
 *      hidden_gem (ขั้วความรู้สึกดีแต่คนอ่านน้อย), fresh (มาใหม่ตรงแนว), popular (fallback cold start)
 *   2. relevanceScore — รวมสัญญาณเป็นคะแนน 0..1 (ไม่ใช้ยอดวิวเป็นสัญญาณบวกเลย)
 *   3. rerankLongTail — Personalized re-ranking แบบ greedy (Abdollahpouri et al., 2019) ดันสัดส่วน
 *      นิยายกลุ่ม long-tail ให้ถึงเป้าโดยเสียความแม่นยำน้อยที่สุด
 */

export type CandidateSource = "interest" | "similar_readers" | "hidden_gem" | "fresh" | "popular";

export interface Candidate {
  novel_id: string;
  sources: Set<CandidateSource>;
  /** จำนวนแท็กที่ตรงกับความสนใจของ user */
  shared_tags: number;
  /** จำนวน user ที่รสนิยมคล้ายกันและชอบเรื่องนี้ (จาก collaborative query) */
  similar_supporters: number;
  /** ขั้วความรู้สึกเฉลี่ยของผู้อ่านทั้งหมด −1..1 (null = ยังไม่มีข้อมูล) */
  avg_polarity: number | null;
  view_count: number;
  created_at: Date;
}

export interface RankingWeights {
  tag: number;
  collab: number;
  sentiment: number;
  freshness: number;
}

export const DEFAULT_WEIGHTS: RankingWeights = { tag: 0.35, collab: 0.25, sentiment: 0.25, freshness: 0.15 };

/** อายุ (วัน) ที่ความใหม่ลดเหลือ ~37% — นิยายอายุ 2 สัปดาห์ยังได้แต้มความใหม่พอสมควร */
export const FRESHNESS_DECAY_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export function relevanceScore(
  c: Candidate,
  ctx: { interest_count: number; now: Date },
  w: RankingWeights = DEFAULT_WEIGHTS
): number {
  // หารด้วย min(3, จำนวนความสนใจ) — ตรง 3 แท็กขึ้นไปถือว่าตรงเต็มที่ ไม่ลงโทษคนที่เลือกความสนใจไว้เยอะ
  const tag = ctx.interest_count > 0 ? Math.min(1, c.shared_tags / Math.min(3, ctx.interest_count)) : 0;
  const collab = Math.min(1, c.similar_supporters / 3);
  // ยังไม่มีใครรีวิว/คอมเมนต์ = กลาง ๆ (0.5) — ไม่ลงโทษนิยายใหม่ที่ยังไม่มีข้อมูล
  const sentiment = c.avg_polarity === null ? 0.5 : (c.avg_polarity + 1) / 2;
  const ageDays = Math.max(0, (ctx.now.getTime() - c.created_at.getTime()) / DAY_MS);
  const freshness = Math.exp(-ageDays / FRESHNESS_DECAY_DAYS);
  const total = w.tag + w.collab + w.sentiment + w.freshness;
  return (w.tag * tag + w.collab * collab + w.sentiment * sentiment + w.freshness * freshness) / total;
}

/**
 * เส้นแบ่ง head/long-tail — นิยายที่ยอดวิวอยู่ใน 20% บนสุดคือ head ที่เหลือคือ long-tail
 * (หลัก Pareto ตามนิยามใน Abdollahpouri et al.) คืนค่ายอดวิวต่ำสุดที่ยังนับเป็น head
 */
export function headThreshold(viewCounts: number[], headShare = 0.2): number {
  if (viewCounts.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...viewCounts].sort((a, b) => b - a);
  const headSize = Math.max(1, Math.ceil(sorted.length * headShare));
  return sorted[headSize - 1];
}

export function isLongTail(view_count: number, threshold: number): boolean {
  return view_count < threshold;
}

export interface Scored {
  novel_id: string;
  score: number;
  long_tail: boolean;
}

export interface RerankOptions {
  k: number;
  /** 0 = ไม่ re-rank (เรียงตามคะแนนล้วน), 1 = ให้ความสำคัญกับการกระจายเต็มที่ */
  lambda: number;
  /** สัดส่วน long-tail เป้าหมายใน top-k */
  target_long_tail_share: number;
}

/**
 * Greedy re-ranking (xQuAD แบบ 2 กลุ่ม): แต่ละรอบเลือกตัวที่ได้ (1−λ)·score + λ·bonus สูงสุด
 * bonus = 1 เมื่อตัวนั้นเป็น long-tail และจำนวน long-tail ที่เลือกแล้วยังไม่ถึงโควตาของตำแหน่งนั้น
 * ทำให้ long-tail ที่คะแนนใกล้เคียงได้ขึ้นมาแทน head ที่คะแนนสูงกว่านิดเดียว แต่ long-tail ที่ไม่ตรงเลย
 * (คะแนนต่ำมาก) จะไม่ถูกดันขึ้นมา
 */
export function rerankLongTail(items: Scored[], opts: RerankOptions): Scored[] {
  const pool = [...items].sort((a, b) => b.score - a.score);
  if (opts.lambda <= 0) return pool.slice(0, opts.k);

  const picked: Scored[] = [];
  let tailCount = 0;
  while (picked.length < opts.k && pool.length > 0) {
    // ต้องการ long-tail เมื่อจำนวนที่เลือกแล้วยังต่ำกว่าโควตาของ "ตำแหน่งถัดไป" — กระจายโควตาตลอดรายการ
    // และอันดับ 1 ยังเป็นตัวที่ตรงที่สุดเสมอ (floor(target × 1) = 0 เมื่อ target < 1)
    const needTail = tailCount < Math.floor(opts.target_long_tail_share * (picked.length + 1));
    let bestIdx = 0;
    let bestVal = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < pool.length; i++) {
      const bonus = needTail && pool[i].long_tail ? 1 : 0;
      const val = (1 - opts.lambda) * pool[i].score + opts.lambda * bonus;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    }
    const [chosen] = pool.splice(bestIdx, 1);
    if (chosen.long_tail) tailCount += 1;
    picked.push(chosen);
  }
  return picked;
}

const SOURCE_PRIORITY: CandidateSource[] = ["similar_readers", "hidden_gem", "fresh", "interest", "popular"];

export type RecommendationReason = CandidateSource;

/** เหตุผลหลักที่แสดงบนการ์ด — เลือกแหล่งที่ "อธิบายได้เฉพาะตัว" มากที่สุดก่อน */
export function primaryReason(c: Candidate, now: Date): RecommendationReason {
  for (const s of SOURCE_PRIORITY) {
    if (!c.sources.has(s)) continue;
    if (s === "fresh" && now.getTime() - c.created_at.getTime() > FRESHNESS_DECAY_DAYS * DAY_MS) continue;
    return s;
  }
  return "interest";
}

/** รวม candidate ที่มาจากหลายแหล่ง (novel_id เดียวกัน) ให้เป็นตัวเดียว */
export function mergeCandidates(list: Candidate[]): Map<string, Candidate> {
  const out = new Map<string, Candidate>();
  for (const c of list) {
    const prev = out.get(c.novel_id);
    if (!prev) {
      out.set(c.novel_id, { ...c, sources: new Set(c.sources) });
      continue;
    }
    c.sources.forEach((s) => prev.sources.add(s));
    prev.shared_tags = Math.max(prev.shared_tags, c.shared_tags);
    prev.similar_supporters = Math.max(prev.similar_supporters, c.similar_supporters);
    prev.avg_polarity = prev.avg_polarity ?? c.avg_polarity;
  }
  return out;
}

/** สัดส่วน long-tail ในรายการ (ใช้ทั้งใน response meta และสคริปต์ประเมินผล) */
export function longTailShare(items: { long_tail: boolean }[]): number {
  if (items.length === 0) return 0;
  return items.filter((i) => i.long_tail).length / items.length;
}
