/**
 * ประเมินระบบแนะนำแบบออฟไลน์บน mock data — KPI-1 (Precision@10 ≥ 70%) และ KPI-2 (long-tail เพิ่ม ≥ 20%)
 * ตาม Proposal 3.5.2 ("ประเมินผลจากการคิวรีชุดข้อมูลนิยายและพฤติกรรมจำลอง")
 *
 * ใช้โค้ดจัดอันดับตัวจริง (src/modules/recommendations/ranking.ts) ส่วนการดึง candidate จำลอง Cypher/SQL
 * ของ recommendations.service.ts ในหน่วยความจำ — ไม่ต้องมี Postgres/Neo4j รันซ้ำได้ผลเดิม (seed คงที่)
 *
 * โลกจำลอง:
 *   - นิยายมีแนว 1–2 แนว + "คุณภาพ" ซ่อนอยู่ + ความดัง (exposure) แบบ power-law ที่ไม่ขึ้นกับคุณภาพ
 *     → จำลอง popularity bias: เรื่องดังไม่จำเป็นต้องดี เรื่องดีอาจไม่มีใครเห็น
 *   - ผู้ใช้ชอบ 2 แนว (เลือกตอน onboarding ถูก 1–2 แนว) อ่านตามการมองเห็นที่เอียงไปทางเรื่องดัง
 *   - อ่านแล้วให้ขั้วความรู้สึก −1..1 ตามความตรงแนว × คุณภาพ + noise (แทนผล sentiment ของรีวิว/คอมเมนต์)
 *   - ground truth "เรื่องที่ผู้ใช้จะชอบ" = ยังไม่อ่าน, ตรงแนวที่ชอบจริง, คุณภาพ ≥ 0.5
 *
 * รัน:  cd apps/api && npx tsx scripts/eval-recs.ts [--seed 42] [--csv out.csv]
 */
import fs from "node:fs";
import {
  type Candidate,
  type CandidateSource,
  headThreshold,
  mergeCandidates,
  relevanceScore,
  rerankLongTail,
} from "../src/modules/recommendations/ranking";

const args = process.argv.slice(2);
const argVal = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const SEED = Number(argVal("--seed") ?? 42);
const CSV = argVal("--csv");

// ---------------------------------------------------------------------------
// RNG (mulberry32) — ผลลัพธ์ซ้ำได้ทุกครั้ง
// ---------------------------------------------------------------------------
let rngState = SEED >>> 0;
function rand() {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (n: number) => Math.floor(rand() * n);
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ---------------------------------------------------------------------------
// โลกจำลอง
// ---------------------------------------------------------------------------
const GENRES = 10;
const N_NOVELS = 600;
const N_USERS = 300;
const READS_PER_USER = 20;
const K = 10;
const NOW = new Date("2026-10-01T00:00:00Z");
const DAY = 86_400_000;

interface Novel {
  id: string;
  genres: Set<number>;
  quality: number;
  exposure: number;
  created_at: Date;
  views: number;
}
interface User {
  id: string;
  likes: Set<number>;
  interests: Set<number>;
  reads: Map<string, number>; // novel_id → polarity
}

const novels: Novel[] = [];
for (let i = 0; i < N_NOVELS; i++) {
  const g = new Set([randInt(GENRES)]);
  if (rand() < 0.5) g.add(randInt(GENRES));
  novels.push({
    id: `n${i}`,
    genres: g,
    quality: rand(),
    // Zipf-like exposure: เรื่องท้าย ๆ ของลิสต์แทบไม่มีใครเห็น (ไม่ผูกกับคุณภาพ)
    exposure: 1 / Math.pow(1 + randInt(N_NOVELS), 0.9),
    created_at: new Date(NOW.getTime() - (rand() < 0.1 ? randInt(30) : 30 + randInt(700)) * DAY),
    views: 0,
  });
}
const novelById = new Map(novels.map((n) => [n.id, n]));

const users: User[] = [];
for (let u = 0; u < N_USERS; u++) {
  const a = randInt(GENRES);
  let b = randInt(GENRES);
  while (b === a) b = randInt(GENRES);
  const likes = new Set([a, b]);
  // onboarding: เลือกถูกทั้งสองแนว 70% / ถูกแนวเดียว + แนวสุ่ม 30%
  const interests = rand() < 0.7 ? new Set(likes) : new Set([a, randInt(GENRES)]);
  users.push({ id: `u${u}`, likes, interests, reads: new Map() });
}

const matches = (u: User, n: Novel) => [...n.genres].some((g) => u.likes.has(g));
const wouldLike = (u: User, n: Novel) => matches(u, n) && n.quality >= 0.5;

// การอ่าน: ผู้ใช้เห็นนิยายตาม exposure (popularity bias) และกดอ่านเรื่องที่ตรงแนวมากกว่า 4 เท่า
for (const u of users) {
  const weights = novels.map((n) => n.exposure * (matches(u, n) ? 4 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (u.reads.size < READS_PER_USER && guard++ < 10_000) {
    let r = rand() * total;
    let idx = 0;
    while (r > weights[idx]) r -= weights[idx++];
    const n = novels[Math.min(idx, novels.length - 1)];
    if (u.reads.has(n.id)) continue;
    const affinity = matches(u, n) ? n.quality * 2 - 0.6 : n.quality - 0.9;
    u.reads.set(n.id, clamp(affinity + gauss() * 0.15, -1, 1));
    n.views += 100 + randInt(50);
  }
}

// ---------------------------------------------------------------------------
// candidate generation (จำลอง recommendations.service.ts)
// ---------------------------------------------------------------------------
const PER_SOURCE = 40;
const FRESH_DAYS = 30;

function blank(id: string, source: CandidateSource): Candidate {
  const n = novelById.get(id)!;
  return { novel_id: id, sources: new Set([source]), shared_tags: 0, similar_supporters: 0, avg_polarity: null, view_count: n.views, created_at: n.created_at };
}

const avgPolarity = new Map<string, { sum: number; count: number }>();
for (const u of users)
  for (const [id, p] of u.reads) {
    const a = avgPolarity.get(id) ?? { sum: 0, count: 0 };
    a.sum += p;
    a.count += 1;
    avgPolarity.set(id, a);
  }
const avgOf = (id: string) => {
  const a = avgPolarity.get(id);
  return a ? a.sum / a.count : null;
};
const sharedTags = (u: User, n: Novel) => [...n.genres].filter((g) => u.interests.has(g)).length;

function candidatesFor(u: User): Candidate[] {
  const unread = novels.filter((n) => !u.reads.has(n.id));
  const out: Candidate[] = [];

  // Q1 interest
  unread
    .map((n) => ({ n, s: sharedTags(u, n) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, PER_SOURCE)
    .forEach(({ n, s }) => out.push({ ...blank(n.id, "interest"), shared_tags: s }));

  // Q2 similar readers (ขั้วต่างกันไม่เกิน 0.3 บนเรื่องเดียวกัน)
  const peers = users.filter(
    (p) => p !== u && [...u.reads].some(([id, pol]) => p.reads.has(id) && Math.abs(p.reads.get(id)! - pol) <= 0.3)
  );
  const support = new Map<string, number>();
  for (const p of peers)
    for (const [id, pol] of p.reads) if (pol > 0.3 && !u.reads.has(id)) support.set(id, (support.get(id) ?? 0) + 1);
  [...support]
    .sort((a, b) => b[1] - a[1])
    .slice(0, PER_SOURCE)
    .forEach(([id, s]) => out.push({ ...blank(id, "similar_readers"), similar_supporters: s }));

  // Q3 hidden gem
  unread
    .filter((n) => (avgOf(n.id) ?? -1) >= 0.3)
    .sort((a, b) => avgPolarity.get(a.id)!.count - avgPolarity.get(b.id)!.count || avgOf(b.id)! - avgOf(a.id)!)
    .slice(0, PER_SOURCE)
    .forEach((n) => out.push({ ...blank(n.id, "hidden_gem"), avg_polarity: avgOf(n.id) }));

  // Q4 fresh
  unread
    .filter((n) => NOW.getTime() - n.created_at.getTime() <= FRESH_DAYS * DAY && sharedTags(u, n) > 0)
    .slice(0, PER_SOURCE)
    .forEach((n) => out.push(blank(n.id, "fresh")));

  return out;
}

const threshold = headThreshold(novels.map((n) => n.views));
const isTail = (id: string) => novelById.get(id)!.views < threshold;

// ---------------------------------------------------------------------------
// อัลกอริทึมที่เปรียบเทียบ
// ---------------------------------------------------------------------------
type Algo = (u: User) => string[];

const popularity: Algo = (u) =>
  novels
    .filter((n) => !u.reads.has(n.id))
    .sort((a, b) => b.views - a.views)
    .slice(0, K)
    .map((n) => n.id);

/** v1 เดิม: content-based ไม่จัดอันดับ + collaborative/underrated ที่ใช้ "ความมั่นใจ" แทนขั้ว (|polarity|) */
const legacy: Algo = (u) => {
  const unread = novels.filter((n) => !u.reads.has(n.id));
  const content = unread.filter((n) => sharedTags(u, n) > 0).slice(0, 10).map((n) => n.id);
  const conf = (p: number) => Math.abs(p); // บั๊กเดิม: รีวิวติแรงก็ได้คะแนนสูง
  const peers = users.filter(
    (p) => p !== u && [...u.reads].some(([id, pol]) => p.reads.has(id) && Math.abs(conf(p.reads.get(id)!) - conf(pol)) <= 0.05)
  );
  const collab = new Set<string>();
  for (const p of peers) for (const [id, pol] of p.reads) if (conf(pol) > 0.5 && !u.reads.has(id) && collab.size < 10) collab.add(id);
  const underrated = unread
    .filter((n) => avgPolarity.has(n.id))
    .map((n) => {
      const a = avgPolarity.get(n.id)!;
      return { id: n.id, c: a.count, s: [...users].reduce((acc, x) => acc + (x.reads.has(n.id) ? conf(x.reads.get(n.id)!) : 0), 0) / a.count };
    })
    .filter((x) => x.s >= 0.5)
    .sort((a, b) => b.s - a.s || a.c - b.c)
    .slice(0, 10)
    .map((x) => x.id);
  return [...new Set([...content, ...collab, ...underrated])].slice(0, K);
};

function v2(lambda: number): Algo {
  return (u) => {
    const merged = mergeCandidates(candidatesFor(u));
    const scored = [...merged.values()].map((c) => {
      c.shared_tags = sharedTags(u, novelById.get(c.novel_id)!);
      c.avg_polarity = avgOf(c.novel_id);
      return { novel_id: c.novel_id, score: relevanceScore(c, { interest_count: u.interests.size, now: NOW }), long_tail: isTail(c.novel_id) };
    });
    return rerankLongTail(scored, { k: K, lambda, target_long_tail_share: 0.4 }).map((s) => s.novel_id);
  };
}

// ---------------------------------------------------------------------------
// วัดผล
// ---------------------------------------------------------------------------
interface Result {
  name: string;
  precision: number;
  longTail: number;
  coverage: number;
}

function evaluate(name: string, algo: Algo): Result {
  let precision = 0;
  let tail = 0;
  let recCount = 0;
  const shown = new Set<string>();
  for (const u of users) {
    const recs = algo(u);
    precision += recs.filter((id) => wouldLike(u, novelById.get(id)!)).length / K;
    tail += recs.filter(isTail).length;
    recCount += recs.length;
    recs.forEach((id) => shown.add(id));
  }
  return { name, precision: precision / users.length, longTail: recCount ? tail / recCount : 0, coverage: shown.size / novels.length };
}

const results = [
  evaluate("popularity (baseline)", popularity),
  evaluate("v1 legacy", legacy),
  evaluate("v2 no re-rank (λ=0)", v2(0)),
  evaluate("v2 re-rank (λ=0.3)", v2(0.3)),
];

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
console.log(`\nBuddyBook recommendation offline evaluation — seed ${SEED}`);
console.log(`${N_USERS} users, ${N_NOVELS} novels, ${READS_PER_USER} reads/user, K=${K}, head = top 20% by views (≥ ${threshold})\n`);
console.log("| Algorithm | Precision@10 | Long-tail share | Catalog coverage |");
console.log("|---|---|---|---|");
for (const r of results) console.log(`| ${r.name} | ${pct(r.precision)} | ${pct(r.longTail)} | ${pct(r.coverage)} |`);

const before = results[2];
const after = results[3];
const relIncrease = before.longTail > 0 ? (after.longTail - before.longTail) / before.longTail : Infinity;
const kpi1 = after.precision >= 0.7;
const kpi2 = relIncrease >= 0.2;
console.log(`\nKPI-1 Precision@10 (v2 re-rank) = ${pct(after.precision)} → ${kpi1 ? "PASS" : "FAIL"} (≥ 70%)`);
console.log(
  `KPI-2 long-tail share ${pct(before.longTail)} → ${pct(after.longTail)} = +${pct(relIncrease)} relative → ${kpi2 ? "PASS" : "FAIL"} (≥ +20%)`
);

if (CSV) {
  fs.writeFileSync(
    CSV,
    ["algorithm,precision_at_10,long_tail_share,catalog_coverage", ...results.map((r) => `${r.name},${r.precision},${r.longTail},${r.coverage}`)].join("\n") + "\n"
  );
  console.log(`\nCSV written to ${CSV}`);
}
