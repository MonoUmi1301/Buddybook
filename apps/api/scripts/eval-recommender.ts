/**
 * ประเมินระบบแนะนำนิยาย (Neo4j) — อ่านอย่างเดียว ไม่เขียน/ลบอะไรใน Postgres หรือ Neo4j
 *
 *   cd apps/api && npx tsx --env-file=.env scripts/eval-recommender.ts [--sample 100] [--seed 42]
 *
 * ผลลัพธ์: docs/eval/recommender-eval.csv และ docs/eval/recommender-eval.md (ที่ root ของ repo)
 *
 * การันตีอ่านอย่างเดียว:
 *   - Postgres: ทุก connection (รวม Prisma ของแอปที่ GET /recommendations ใช้) เปิดด้วย
 *     default_transaction_read_only=on — ฐานข้อมูลปฏิเสธ INSERT/UPDATE/DELETE เอง
 *   - Neo4j: query ของสคริปต์รันใน session.executeRead (READ access mode) ส่วน getRecommendations()
 *     ของแอปเป็น MATCH/RETURN ล้วน และสคริปต์เทียบจำนวน node/relationship ก่อน-หลังรันเพื่อยืนยัน
 *
 * สิ่งที่ประเมิน:
 *   1. Correctness — จำนวนข้อมูล Postgres vs Neo4j, ความคล้ายของ 20 คู่ผู้ใช้ (คำนวณเองเทียบ Neo4j),
 *      คำแนะนำจริงจาก getRecommendations() ห้ามมีเรื่องที่อ่านแล้ว/ไม่ published/ของตัวเอง, latency
 *   2. Offline eval ของ collaborative filtering (Q2) ที่ threshold ต่าง ๆ เทียบ popularity baseline
 *      แบ่งข้อมูลต่อผู้ใช้ตามเวลา train/val/test, ความคล้ายคำนวณจาก train เท่านั้น
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import neo4j, { type Session } from "neo4j-driver";
import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// ตั้งค่า
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const argNum = (name: string, def: number) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : def;
};
const CFG = {
  latencySample: argNum("sample", 100),
  authorSample: 20,
  similarityPairs: 20,
  seed: argNum("seed", 42),
  thresholds: [0.01, 0.03, 0.05, 0.07, 0.1],
  ks: [5, 10],
  topNNeighbors: 10,
  /** เกณฑ์ของ Q2 ในระบบจริง — candidate ต้องมี sentiment ของเพื่อนบ้าน > ค่านี้ */
  candidateMinSentiment: 0.5,
  relevantMinRating: 4,
  minUserCoverage: 0.8,
  minUsersForSignificance: 30,
  minInteractionsForSignificance: 5,
  splitShare: { val: 0.2, test: 0.2 },
};
const OUT_DIR = path.resolve(__dirname, "../../../docs/eval");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required — run with --env-file=.env");
// บังคับอ่านอย่างเดียวที่ระดับ connection ก่อน import โมดูลของแอป (env.ts/prisma.ts อ่านค่าตอน import)
const roUrl = new URL(process.env.DATABASE_URL);
roUrl.searchParams.set("options", "-c default_transaction_read_only=on");
process.env.DATABASE_URL = roUrl.toString();

// ---------------------------------------------------------------------------
// ยูทิลิตี
// ---------------------------------------------------------------------------
let rngState = CFG.seed >>> 0;
const rand = () => {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const sample = <T>(xs: readonly T[], n: number): T[] => {
  const copy = [...xs];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};
const quantile = (xs: number[], p: number) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const toNum = (v: unknown): number =>
  v === null || v === undefined ? NaN : typeof v === "number" ? v : neo4j.isInt(v) ? v.toNumber() : Number(v);
const fmt = (x: number, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const pct = (x: number) => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}%` : "—");

// ---------------------------------------------------------------------------
// โหลดข้อมูลจาก Postgres (read-only)
// ---------------------------------------------------------------------------
interface ReviewRow {
  user_id: string;
  novel_id: string;
  rating: number | null;
  sentiment: number | null;
  t: number;
}

async function loadPostgres(prisma: PrismaClient) {
  const [users, novels, novelTags, interests, reviews, library, progress] = await Promise.all([
    prisma.user.findMany({ select: { user_id: true } }),
    prisma.novel.findMany({ select: { novel_id: true, author_id: true, visibility: true } }),
    prisma.novelTag.findMany({ select: { novel_id: true, tag: { select: { name: true } } } }),
    prisma.userInterest.findMany({ select: { user_id: true, tag: { select: { name: true } } } }),
    prisma.review.findMany({
      select: { user_id: true, novel_id: true, rating: true, sentiment_score: true, created_at: true },
    }),
    prisma.userLibrary.findMany({ select: { user_id: true, novel_id: true } }),
    prisma.readingProgress.findMany({ select: { user_id: true, novel_id: true } }),
  ]);

  const published = new Set(novels.filter((n) => n.visibility === "published").map((n) => n.novel_id));
  const authorOf = new Map(novels.map((n) => [n.novel_id, n.author_id]));
  const tagsOf = new Map<string, Set<string>>();
  for (const nt of novelTags) {
    const set = tagsOf.get(nt.novel_id) ?? new Set<string>();
    set.add(nt.tag.name);
    tagsOf.set(nt.novel_id, set);
  }
  const readAny = new Map<string, Set<string>>();
  for (const r of [...library, ...progress]) {
    const set = readAny.get(r.user_id) ?? new Set<string>();
    set.add(r.novel_id);
    readAny.set(r.user_id, set);
  }
  const reviewRows: ReviewRow[] = reviews.map((r) => ({
    user_id: r.user_id,
    novel_id: r.novel_id,
    rating: r.rating,
    sentiment: r.sentiment_score,
    t: r.created_at.getTime(),
  }));

  return { users, novels, novelTags, interests, reviews: reviewRows, published, authorOf, tagsOf, readAny };
}
type PgData = Awaited<ReturnType<typeof loadPostgres>>;

// ---------------------------------------------------------------------------
// Neo4j (READ access mode)
// ---------------------------------------------------------------------------
async function readCypher(session: Session, cypher: string, params: Record<string, unknown> = {}) {
  const res = await session.executeRead((tx) => tx.run(cypher, params));
  return res.records;
}

async function graphFingerprint(session: Session) {
  const labels = await readCypher(session, "MATCH (n) RETURN labels(n)[0] AS k, count(*) AS c");
  const rels = await readCypher(session, "MATCH ()-[r]->() RETURN type(r) AS k, count(*) AS c");
  const m: Record<string, number> = {};
  for (const r of [...labels, ...rels]) m[String(r.get("k"))] = toNum(r.get("c"));
  return m;
}

async function pgFingerprint(prisma: PrismaClient) {
  const [users, novels, reviews, library, interests] = await Promise.all([
    prisma.user.count(),
    prisma.novel.count(),
    prisma.review.count(),
    prisma.userLibrary.count(),
    prisma.userInterest.count(),
  ]);
  return { users, novels, reviews, user_library: library, user_interests: interests };
}

// ---------------------------------------------------------------------------
// 1. Correctness
// ---------------------------------------------------------------------------
interface CountRow {
  item: string;
  postgres: number;
  neo4j: number;
}

async function compareCounts(session: Session, pg: PgData) {
  const g = await graphFingerprint(session);
  const pubTags = pg.novelTags.filter((nt) => pg.published.has(nt.novel_id));
  const tagNames = new Set([...pubTags.map((nt) => nt.tag.name), ...pg.interests.map((i) => i.tag.name)]);
  const readPairs = new Set(pg.reviews.map((r) => `${r.user_id}|${r.novel_id}`));
  const scoredPairs = new Set(pg.reviews.filter((r) => r.sentiment !== null).map((r) => `${r.user_id}|${r.novel_id}`));
  const scoredInGraph = toNum(
    (await readCypher(session, "MATCH ()-[r:READ]->() WHERE r.sentiment_score IS NOT NULL RETURN count(r) AS c"))[0].get("c")
  );

  const rows: CountRow[] = [
    { item: "User", postgres: pg.users.length, neo4j: g.User ?? 0 },
    { item: "Novel (published)", postgres: pg.published.size, neo4j: g.Novel ?? 0 },
    { item: "Tag (ที่ถูกใช้)", postgres: tagNames.size, neo4j: g.Tag ?? 0 },
    { item: "HAS_TAG", postgres: pubTags.length, neo4j: g.HAS_TAG ?? 0 },
    { item: "INTERESTED_IN", postgres: pg.interests.length, neo4j: g.INTERESTED_IN ?? 0 },
    { item: "READ (คู่ user–novel ที่มีรีวิว)", postgres: readPairs.size, neo4j: g.READ ?? 0 },
    { item: "READ ที่มี sentiment_score", postgres: scoredPairs.size, neo4j: scoredInGraph },
  ];

  // id ที่อยู่ฝั่งเดียว (node ผี / ยังไม่ sync)
  const graphNovelIds = new Set(
    (await readCypher(session, "MATCH (n:Novel) RETURN n.novel_id AS id")).map((r) => String(r.get("id")))
  );
  const graphUserIds = new Set(
    (await readCypher(session, "MATCH (u:User) RETURN u.user_id AS id")).map((r) => String(r.get("id")))
  );
  const pgUserIds = new Set(pg.users.map((u) => u.user_id));
  const drift = {
    novelsOnlyInNeo4j: [...graphNovelIds].filter((id) => !pg.published.has(id)).length,
    novelsOnlyInPostgres: [...pg.published].filter((id) => !graphNovelIds.has(id)).length,
    usersOnlyInNeo4j: [...graphUserIds].filter((id) => !pgUserIds.has(id)).length,
    usersOnlyInPostgres: [...pgUserIds].filter((id) => !graphUserIds.has(id)).length,
  };
  return { rows, drift };
}

interface PairResult {
  a: string;
  b: string;
  shared_ts: number;
  shared_neo4j: number;
  min_dist_ts: number;
  min_dist_neo4j: number;
  within_005_ts: number;
  within_005_neo4j: number;
  match: boolean;
}

/** "ความคล้าย" ที่ระบบใช้จริงคือระยะ |Δsentiment| ต่อเรื่องที่อ่านร่วมกัน (ไม่มีค่ารวมต่อคู่)
 *  จึงเทียบ 3 ค่าต่อคู่: จำนวนเรื่องร่วม, ระยะต่ำสุด, จำนวนเรื่องร่วมที่ระยะ <= 0.05 (เกณฑ์จริงของ Q2) */
async function compareSimilarity(session: Session, pg: PgData): Promise<PairResult[]> {
  const byNovel = new Map<string, ReviewRow[]>();
  const byUser = new Map<string, ReviewRow[]>();
  for (const r of pg.reviews) {
    if (r.sentiment === null) continue;
    (byNovel.get(r.novel_id) ?? byNovel.set(r.novel_id, []).get(r.novel_id)!).push(r);
    (byUser.get(r.user_id) ?? byUser.set(r.user_id, []).get(r.user_id)!).push(r);
  }

  // สุ่มคู่ที่อ่านเรื่องเดียวกันอย่างน้อย 1 เรื่อง (คู่ที่ไม่มีเรื่องร่วม ระบบไม่มีทางจับคู่อยู่แล้ว)
  const pairs = new Set<string>();
  const usersWithReviews = [...byUser.keys()];
  for (let tries = 0; pairs.size < CFG.similarityPairs && tries < 10_000; tries++) {
    const a = usersWithReviews[Math.floor(rand() * usersWithReviews.length)];
    const own = byUser.get(a)!;
    const via = own[Math.floor(rand() * own.length)];
    const others = byNovel.get(via.novel_id)!.filter((r) => r.user_id !== a);
    if (!others.length) continue;
    const b = others[Math.floor(rand() * others.length)].user_id;
    pairs.add([a, b].sort().join("|"));
  }

  const results: PairResult[] = [];
  for (const key of pairs) {
    const [a, b] = key.split("|");
    const sb = new Map(byUser.get(b)!.map((r) => [r.novel_id, r.sentiment as number]));
    const dists = byUser
      .get(a)!
      .filter((r) => sb.has(r.novel_id))
      .map((r) => Math.abs((r.sentiment as number) - sb.get(r.novel_id)!));
    const rec = (
      await readCypher(
        session,
        `MATCH (a:User {user_id: $a})-[r1:READ]->(n:Novel)<-[r2:READ]-(b:User {user_id: $b})
         WHERE r1.sentiment_score IS NOT NULL AND r2.sentiment_score IS NOT NULL
         WITH abs(r1.sentiment_score - r2.sentiment_score) AS d
         RETURN count(d) AS shared, min(d) AS min_dist, sum(CASE WHEN d <= 0.05 THEN 1 ELSE 0 END) AS within`,
        { a, b }
      )
    )[0];
    const row: PairResult = {
      a,
      b,
      shared_ts: dists.length,
      shared_neo4j: toNum(rec.get("shared")),
      min_dist_ts: dists.length ? Math.min(...dists) : NaN,
      min_dist_neo4j: toNum(rec.get("min_dist")),
      within_005_ts: dists.filter((d) => d <= 0.05).length,
      within_005_neo4j: toNum(rec.get("within")),
      match: false,
    };
    row.match =
      row.shared_ts === row.shared_neo4j &&
      row.within_005_ts === row.within_005_neo4j &&
      Math.abs(row.min_dist_ts - row.min_dist_neo4j) < 1e-9;
    results.push(row);
  }
  return results;
}

interface SanityResult {
  sampled: { readers: number; authors: number };
  latency: { p50: number; p95: number; max: number; n: number };
  lists: Record<
    string,
    { usersWithItems: number; items: number; reviewed: number; readInLibrary: number; unpublished: number; self: number; duplicates: number }
  >;
}

async function checkLiveRecommendations(pg: PgData): Promise<SanityResult> {
  // import หลังตั้ง DATABASE_URL แบบ read-only แล้ว — Prisma ของแอปจึงอ่านอย่างเดียวด้วย
  const { getRecommendations } = await import("@/modules/recommendations/recommendations.service");

  const reviewed = new Map<string, Set<string>>();
  for (const r of pg.reviews) (reviewed.get(r.user_id) ?? reviewed.set(r.user_id, new Set()).get(r.user_id)!).add(r.novel_id);
  const authorIds = [...new Set(pg.novels.map((n) => n.author_id))];
  const readers = sample([...reviewed.keys()], CFG.latencySample);
  const authors = sample(authorIds, CFG.authorSample);

  // warm-up (ไม่นับ latency)
  for (const u of readers.slice(0, 5)) await getRecommendations(u);

  const times: number[] = [];
  const lists: SanityResult["lists"] = {};
  for (const user_id of [...readers, ...authors]) {
    const t = performance.now();
    const rec = await getRecommendations(user_id);
    times.push(performance.now() - t);
    for (const [name, items] of Object.entries(rec) as [string, readonly { novel_id: string }[]][]) {
      const s = (lists[name] ??= { usersWithItems: 0, items: 0, reviewed: 0, readInLibrary: 0, unpublished: 0, self: 0, duplicates: 0 });
      if (items.length) s.usersWithItems++;
      s.items += items.length;
      s.duplicates += items.length - new Set(items.map((i) => i.novel_id)).size;
      for (const { novel_id } of items) {
        if (reviewed.get(user_id)?.has(novel_id)) s.reviewed++;
        if (pg.readAny.get(user_id)?.has(novel_id)) s.readInLibrary++;
        if (!pg.published.has(novel_id)) s.unpublished++;
        if (pg.authorOf.get(novel_id) === user_id) s.self++;
      }
    }
  }
  return {
    sampled: { readers: readers.length, authors: authors.length },
    latency: { p50: quantile(times, 0.5), p95: quantile(times, 0.95), max: Math.max(...times), n: times.length },
    lists,
  };
}

// ---------------------------------------------------------------------------
// 2. Offline eval
// ---------------------------------------------------------------------------
type Split = "train" | "val" | "test";
interface UserSplit {
  train: ReviewRow[];
  val: ReviewRow[];
  test: ReviewRow[];
}

/** แบ่งต่อผู้ใช้ตามเวลา: เก่าสุด → train, ถัดมา 20% → val, ล่าสุด 20% → test (อย่างน้อยส่วนละ 1)
 *  ผู้ใช้ที่มีรีวิว < 3 รายการ อยู่ใน train ทั้งหมด (เป็นเพื่อนบ้านได้ แต่ไม่ถูกประเมิน) */
function splitByTime(reviews: ReviewRow[]) {
  const byUser = new Map<string, ReviewRow[]>();
  for (const r of reviews) (byUser.get(r.user_id) ?? byUser.set(r.user_id, []).get(r.user_id)!).push(r);
  const splits = new Map<string, UserSplit>();
  for (const [u, rows] of byUser) {
    rows.sort((x, y) => x.t - y.t || x.novel_id.localeCompare(y.novel_id));
    const n = rows.length;
    if (n < 3) {
      splits.set(u, { train: rows, val: [], test: [] });
      continue;
    }
    const nTest = Math.max(1, Math.round(n * CFG.splitShare.test));
    const nVal = Math.max(1, Math.round(n * CFG.splitShare.val));
    const nTrain = n - nTest - nVal;
    if (nTrain < 1) {
      splits.set(u, { train: rows.slice(0, 1), val: rows.slice(1, 2), test: rows.slice(2) });
      continue;
    }
    splits.set(u, { train: rows.slice(0, nTrain), val: rows.slice(nTrain, nTrain + nVal), test: rows.slice(nTrain + nVal) });
  }
  return splits;
}

interface Neighbor {
  matched: string[]; // เรื่องที่อ่านร่วมและระยะ <= threshold
  minDist: number;
}

/** คำนวณจาก train เท่านั้น: เพื่อนบ้านของ user ที่ threshold หนึ่ง ตามกฎของ Q2
 *  (มีเรื่องที่อ่านร่วมอย่างน้อย 1 เรื่องที่ |Δsentiment| <= threshold) */
function neighborsFor(
  user: string,
  trainByUser: Map<string, ReviewRow[]>,
  trainByNovel: Map<string, ReviewRow[]>,
  threshold: number
) {
  const out = new Map<string, Neighbor>();
  for (const mine of trainByUser.get(user) ?? []) {
    if (mine.sentiment === null) continue;
    for (const other of trainByNovel.get(mine.novel_id) ?? []) {
      if (other.user_id === user || other.sentiment === null) continue;
      const d = Math.abs(other.sentiment - mine.sentiment);
      if (d > threshold) continue;
      const nb = out.get(other.user_id) ?? { matched: [], minDist: Infinity };
      nb.matched.push(mine.novel_id);
      nb.minDist = Math.min(nb.minDist, d);
      out.set(other.user_id, nb);
    }
  }
  return out;
}

interface RankedList {
  items: string[];
  neighbors: number;
}

/** จำลอง Q2: candidate = เรื่องที่เพื่อนบ้านให้ sentiment > 0.5 และมีแท็กร่วมกับเรื่องที่อ่านร่วม
 *  ระบบจริงไม่มี ORDER BY (LIMIT 10 ลำดับไม่แน่นอน) — ที่นี่เรียงตามจำนวนเพื่อนบ้านที่แนะนำ แล้วตาม popularity */
function collaborative(
  user: string,
  exclude: Set<string>,
  neighbors: Map<string, Neighbor>,
  topN: number | null,
  ctx: EvalContext
): RankedList {
  let chosen = [...neighbors.entries()];
  if (topN !== null) {
    chosen = chosen
      .sort((x, y) => y[1].matched.length - x[1].matched.length || x[1].minDist - y[1].minDist || x[0].localeCompare(y[0]))
      .slice(0, topN);
  }
  const score = new Map<string, number>();
  for (const [nbId, nb] of chosen) {
    const sharedTags = new Set<string>();
    for (const n of nb.matched) for (const t of ctx.pg.tagsOf.get(n) ?? []) sharedTags.add(t);
    for (const cand of ctx.trainByUser.get(nbId) ?? []) {
      if (cand.sentiment === null || cand.sentiment <= CFG.candidateMinSentiment) continue;
      const c = cand.novel_id;
      if (exclude.has(c) || !ctx.pg.published.has(c) || ctx.pg.authorOf.get(c) === user) continue;
      let tagOk = false;
      for (const t of ctx.pg.tagsOf.get(c) ?? []) if (sharedTags.has(t)) { tagOk = true; break; }
      if (!tagOk) continue;
      score.set(c, (score.get(c) ?? 0) + 1);
    }
  }
  const items = [...score.entries()]
    .sort((x, y) => y[1] - x[1] || (ctx.popularity.get(y[0]) ?? 0) - (ctx.popularity.get(x[0]) ?? 0) || x[0].localeCompare(y[0]))
    .map(([id]) => id);
  return { items, neighbors: chosen.length };
}

function popularityList(user: string, exclude: Set<string>, ctx: EvalContext, k: number): RankedList {
  const items: string[] = [];
  for (const id of ctx.popularRanked) {
    if (items.length >= k) break;
    if (!exclude.has(id) && ctx.pg.authorOf.get(id) !== user) items.push(id);
  }
  return { items, neighbors: 0 };
}

interface EvalContext {
  pg: PgData;
  trainByUser: Map<string, ReviewRow[]>;
  trainByNovel: Map<string, ReviewRow[]>;
  popularity: Map<string, number>;
  popularRanked: string[];
}

interface MetricRow {
  split: "val" | "test";
  method: string;
  threshold: number | null;
  k: number;
  users: number;
  precision: number;
  recall: number;
  f1: number;
  ndcg: number;
  hit_rate: number;
  user_coverage: number;
  catalog_coverage: number;
  avg_neighbors: number;
}

/** relevant = รีวิวใน split นั้นที่ rating >= 4, gain ของ NDCG = rating ของเรื่องนั้น (เรื่องไม่ relevant = 0) */
function scoreLists(lists: Map<string, RankedList>, relevant: Map<string, Map<string, number>>, k: number, catalogSize: number) {
  const p: number[] = [], r: number[] = [], f: number[] = [], nd: number[] = [], hit: number[] = [], nb: number[] = [];
  const recommended = new Set<string>();
  let covered = 0;
  for (const [u, rel] of relevant) {
    const list = lists.get(u) ?? { items: [], neighbors: 0 };
    const top = list.items.slice(0, k);
    if (top.length) covered++;
    top.forEach((i) => recommended.add(i));
    const hits = top.filter((i) => rel.has(i)).length;
    const prec = hits / k;
    const rec = hits / rel.size;
    p.push(prec);
    r.push(rec);
    f.push(prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0);
    hit.push(hits > 0 ? 1 : 0);
    const dcg = top.reduce((acc, item, i) => acc + (rel.get(item) ?? 0) / Math.log2(i + 2), 0);
    const ideal = [...rel.values()].sort((a, b) => b - a).slice(0, k);
    const idcg = ideal.reduce((acc, g, i) => acc + g / Math.log2(i + 2), 0);
    nd.push(idcg > 0 ? dcg / idcg : 0);
    nb.push(list.neighbors);
  }
  const n = relevant.size;
  return {
    users: n,
    precision: mean(p),
    recall: mean(r),
    f1: mean(f),
    ndcg: mean(nd),
    hit_rate: mean(hit),
    user_coverage: n ? covered / n : 0,
    catalog_coverage: catalogSize ? recommended.size / catalogSize : 0,
    avg_neighbors: mean(nb),
  };
}

function offlineEval(pg: PgData) {
  const splits = splitByTime(pg.reviews);
  const trainByUser = new Map<string, ReviewRow[]>();
  const trainByNovel = new Map<string, ReviewRow[]>();
  for (const [u, s] of splits) {
    trainByUser.set(u, s.train);
    for (const r of s.train) (trainByNovel.get(r.novel_id) ?? trainByNovel.set(r.novel_id, []).get(r.novel_id)!).push(r);
  }
  // popularity จาก train เท่านั้น: จำนวนรีวิวใน train
  const popularity = new Map<string, number>();
  for (const [novel, rows] of trainByNovel) popularity.set(novel, rows.length);
  const popularRanked = [...pg.published]
    .sort((a, b) => (popularity.get(b) ?? 0) - (popularity.get(a) ?? 0) || a.localeCompare(b));
  const ctx: EvalContext = { pg, trainByUser, trainByNovel, popularity, popularRanked };

  const evalSplits: ("val" | "test")[] = ["val", "test"];
  const relevant: Record<"val" | "test", Map<string, Map<string, number>>> = { val: new Map(), test: new Map() };
  const exclude: Record<"val" | "test", Map<string, Set<string>>> = { val: new Map(), test: new Map() };
  for (const [u, s] of splits) {
    for (const split of evalSplits) {
      const rel = new Map(
        s[split].filter((r) => (r.rating ?? 0) >= CFG.relevantMinRating).map((r) => [r.novel_id, r.rating as number])
      );
      if (!rel.size) continue;
      relevant[split].set(u, rel);
      const seen: ReviewRow[] = split === "val" ? s.train : [...s.train, ...s.val];
      exclude[split].set(u, new Set(seen.map((r) => r.novel_id)));
    }
  }

  const evalUsers = new Set([...relevant.val.keys(), ...relevant.test.keys()]);
  const kMax = Math.max(...CFG.ks);
  const rows: MetricRow[] = [];
  const catalogSize = pg.published.size;

  for (const split of evalSplits) {
    for (const k of CFG.ks) {
      const lists = new Map<string, RankedList>();
      for (const u of relevant[split].keys()) lists.set(u, popularityList(u, exclude[split].get(u)!, ctx, k));
      rows.push({ split, method: "popularity", threshold: null, k, ...scoreLists(lists, relevant[split], k, catalogSize) });
    }
  }

  for (const threshold of CFG.thresholds) {
    // เพื่อนบ้านมาจาก train เท่านั้น จึงใช้ชุดเดียวกันทั้ง val และ test
    const neighborCache = new Map<string, Map<string, Neighbor>>();
    for (const u of evalUsers) neighborCache.set(u, neighborsFor(u, trainByUser, trainByNovel, threshold));
    for (const [method, topN] of [["cf-threshold", null], [`cf-threshold-top${CFG.topNNeighbors}`, CFG.topNNeighbors]] as const) {
      for (const split of evalSplits) {
        const lists = new Map<string, RankedList>();
        for (const u of relevant[split].keys()) {
          const list = collaborative(u, exclude[split].get(u)!, neighborCache.get(u)!, topN, ctx);
          lists.set(u, { items: list.items.slice(0, kMax), neighbors: list.neighbors });
        }
        for (const k of CFG.ks) rows.push({ split, method, threshold, k, ...scoreLists(lists, relevant[split], k, catalogSize) });
      }
    }
  }

  const perUser = new Map<string, number>();
  for (const r of pg.reviews) perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + 1);
  const activeUsers = [...perUser.values()].filter((n) => n >= CFG.minInteractionsForSignificance).length;
  const splitSizes = { train: 0, val: 0, test: 0 } as Record<Split, number>;
  for (const s of splits.values()) {
    splitSizes.train += s.train.length;
    splitSizes.val += s.val.length;
    splitSizes.test += s.test.length;
  }
  return {
    rows,
    activeUsers,
    splitSizes,
    evalUsers: { val: relevant.val.size, test: relevant.test.size },
    usersInSplit: [...splits.values()].filter((s) => s.test.length > 0).length,
  };
}

// ---------------------------------------------------------------------------
// 3. Output
// ---------------------------------------------------------------------------
function selectThreshold(rows: MetricRow[]) {
  const candidates = rows.filter((r) => r.split === "val" && r.method.startsWith("cf") && r.k === 10);
  const eligible = candidates.filter((r) => r.user_coverage >= CFG.minUserCoverage);
  const best = [...eligible].sort((a, b) => b.ndcg - a.ndcg)[0] ?? null;
  const bestCoverage = [...candidates].sort((a, b) => b.user_coverage - a.user_coverage)[0] ?? null;
  return { best, bestCoverage, eligibleCount: eligible.length };
}

function metricsTable(rows: MetricRow[]) {
  const header =
    "| method | threshold | K | users | Precision@K | Recall@K | F1@K | NDCG@K | HitRate@K | user cov. | catalog cov. | avg neighbors |\n" +
    "|---|---|---|---|---|---|---|---|---|---|---|---|";
  const body = rows
    .map(
      (r) =>
        `| ${r.method} | ${r.threshold ?? "—"} | ${r.k} | ${r.users} | ${fmt(r.precision)} | ${fmt(r.recall)} | ${fmt(r.f1)} | ${fmt(
          r.ndcg
        )} | ${fmt(r.hit_rate)} | ${pct(r.user_coverage)} | ${pct(r.catalog_coverage)} | ${fmt(r.avg_neighbors, 1)} |`
    )
    .join("\n");
  return `${header}\n${body}`;
}

const STEP0 = `## 0. ระบบแนะนำปัจจุบันทำงานอย่างไร (อ่านจาก \`apps/api/src/modules/recommendations/recommendations.service.ts\`)

| คำถาม | คำตอบ |
|---|---|
| สูตร similarity | **ไม่มีสูตรมาตรฐาน** (ไม่ใช่ Jaccard / cosine / Pearson / GDS nodeSimilarity) Q2 ใช้ระยะ \`abs(r1.sentiment_score - r2.sentiment_score)\` **ทีละเรื่องที่อ่านร่วมกัน** ไม่มีค่ารวมต่อคู่ผู้ใช้ |
| threshold | แบบ **ระยะห่าง \`<= 0.05\`** — เป็นเพื่อนบ้านทันทีถ้ามีเรื่องร่วม **อย่างน้อย 1 เรื่อง** ที่ sentiment ต่างกันไม่เกิน 0.05 |
| topK เพื่อนบ้าน | **ไม่มี** ใช้เพื่อนบ้านทุกคนที่ผ่านเกณฑ์ ผลลัพธ์ตัดที่ \`LIMIT 10\` โดย **ไม่มี ORDER BY** (ลำดับ/ชุดที่ได้ไม่แน่นอน) |
| candidate (Q2) | เรื่องที่เพื่อนบ้านให้ \`sentiment_score > 0.5\`, ผู้ใช้ยังไม่มีเส้น READ และ **มีแท็กร่วม** กับเรื่องที่อ่านร่วม |
| สัญญาณที่ใช้ | **รีวิวเท่านั้น** (เส้น \`READ\` สร้างจากตาราง reviews พร้อม \`sentiment_score\`) + \`INTERESTED_IN\` (แท็กตอน onboarding) + \`HAS_TAG\` — **ไม่ใช้** like, ชั้นหนังสือ, reading progress และไม่ใช้ \`rating\` (sync ไม่ได้ส่ง rating เข้า Neo4j แม้คอมเมนต์ใน neo4j.ts จะเขียนไว้) |
| Q1 content-based | แท็กที่สนใจ ∩ แท็กนิยาย, ตัดเรื่องที่มีเส้น READ, \`LIMIT 10\` ไม่มี ORDER BY |
| Q3 underrated | avg sentiment >= 0.5 เรียง avg desc แล้วจำนวนคนอ่าน asc, \`LIMIT 10\` |
| "อ่านแล้ว" ในทุก query | = มีรีวิว (เส้น READ) เท่านั้น — เรื่องที่อยู่ในชั้นหนังสือ/กำลังอ่านแต่ไม่ได้รีวิว **ยังถูกแนะนำได้** |
`;

function writeOutputs(
  ctx: {
    startedAt: Date;
    counts: Awaited<ReturnType<typeof compareCounts>>;
    pairs: PairResult[];
    sanity: SanityResult;
    offline: ReturnType<typeof offlineEval>;
    unchanged: { postgres: boolean; neo4j: boolean };
    dbLabel: string;
  }
) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { offline } = ctx;
  const csvHeader = "split,method,threshold,k,users,precision,recall,f1,ndcg,hit_rate,user_coverage,catalog_coverage,avg_neighbors";
  const csv = [
    csvHeader,
    ...offline.rows.map((r) =>
      [r.split, r.method, r.threshold ?? "", r.k, r.users, r.precision, r.recall, r.f1, r.ndcg, r.hit_rate, r.user_coverage, r.catalog_coverage, r.avg_neighbors]
        .map((v) => (typeof v === "number" && !Number.isInteger(v) ? v.toFixed(6) : String(v)))
        .join(",")
    ),
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "recommender-eval.csv"), csv + "\n");

  const sel = selectThreshold(offline.rows);
  const testOf = (m: MetricRow | null, k = 10) =>
    m ? offline.rows.find((r) => r.split === "test" && r.method === m.method && r.threshold === m.threshold && r.k === k) ?? null : null;
  const popTest = offline.rows.find((r) => r.split === "test" && r.method === "popularity" && r.k === 10)!;
  const lowData = offline.activeUsers < CFG.minUsersForSignificance;

  const pairMismatch = ctx.pairs.filter((p) => !p.match).length;
  const countMismatch = ctx.counts.rows.filter((r) => r.postgres !== r.neo4j).length;
  const md: string[] = [];
  md.push(`# ผลประเมินระบบแนะนำ (Neo4j)\n`);
  md.push(
    `รันเมื่อ ${ctx.startedAt.toISOString()} · ฐานข้อมูล ${ctx.dbLabel} · seed ${CFG.seed} · สคริปต์ \`apps/api/scripts/eval-recommender.ts\` (อ่านอย่างเดียว)\n`
  );
  md.push(
    `ข้อมูลไม่ถูกแก้ระหว่างรัน: Postgres ${ctx.unchanged.postgres ? "✅ เท่าเดิม" : "❌ เปลี่ยน"} · Neo4j ${ctx.unchanged.neo4j ? "✅ เท่าเดิม" : "❌ เปลี่ยน"}\n`
  );
  if (lowData) {
    md.push(
      `> ⚠️ **ผลไม่มีนัยสำคัญทางสถิติ** — มีผู้ใช้ที่มี interaction (รีวิว) >= ${CFG.minInteractionsForSignificance} รายการเพียง ${offline.activeUsers} คน (ต่ำกว่า ${CFG.minUsersForSignificance})\n`
    );
  }
  md.push(STEP0);

  md.push(`## 1. Correctness\n`);
  md.push(`### 1.1 จำนวนข้อมูล Postgres vs Neo4j ${countMismatch ? `— ❌ ไม่ตรง ${countMismatch} รายการ` : "— ✅ ตรงทุกรายการ"}\n`);
  md.push("| รายการ | Postgres | Neo4j | ตรง |\n|---|---|---|---|");
  for (const r of ctx.counts.rows) md.push(`| ${r.item} | ${r.postgres} | ${r.neo4j} | ${r.postgres === r.neo4j ? "✅" : "❌"} |`);
  const d = ctx.counts.drift;
  md.push(
    `\nid ที่อยู่ฝั่งเดียว: นิยายเฉพาะใน Neo4j ${d.novelsOnlyInNeo4j}, นิยายเฉพาะใน Postgres ${d.novelsOnlyInPostgres}, ผู้ใช้เฉพาะใน Neo4j ${d.usersOnlyInNeo4j}, ผู้ใช้เฉพาะใน Postgres ${d.usersOnlyInPostgres}\n`
  );

  md.push(
    `### 1.2 ความคล้ายของ ${ctx.pairs.length} คู่ผู้ใช้: คำนวณเองจาก Postgres vs Neo4j ${pairMismatch ? `— ❌ ไม่ตรง ${pairMismatch} คู่` : "— ✅ ตรงทุกคู่"}\n`
  );
  md.push("เทียบ 3 ค่าที่ Q2 ใช้จริง: จำนวนเรื่องที่อ่านร่วม, ระยะ |Δsentiment| ต่ำสุด, จำนวนเรื่องร่วมที่ระยะ <= 0.05\n");
  md.push("| user A | user B | ร่วม (TS/Neo4j) | ระยะต่ำสุด (TS/Neo4j) | <= 0.05 (TS/Neo4j) | ตรง |\n|---|---|---|---|---|---|");
  for (const p of ctx.pairs) {
    md.push(
      `| ${p.a.slice(0, 8)} | ${p.b.slice(0, 8)} | ${p.shared_ts} / ${p.shared_neo4j} | ${fmt(p.min_dist_ts)} / ${fmt(p.min_dist_neo4j)} | ${p.within_005_ts} / ${p.within_005_neo4j} | ${p.match ? "✅" : "❌"} |`
    );
  }

  const s = ctx.sanity;
  md.push(`\n### 1.3 คำแนะนำจริงจาก \`getRecommendations()\` (${s.sampled.readers} ผู้อ่านที่มีรีวิว + ${s.sampled.authors} นักเขียน)\n`);
  md.push(
    "| รายการ | ผู้ใช้ที่ได้ผล | จำนวนเรื่อง | รีวิวไปแล้ว | อยู่ในชั้นหนังสือ/อ่านอยู่ | ไม่ published | ผลงานตัวเอง | ซ้ำในรายการ |\n|---|---|---|---|---|---|---|---|"
  );
  for (const [name, v] of Object.entries(s.lists)) {
    md.push(
      `| ${name} | ${v.usersWithItems} | ${v.items} | ${v.reviewed} | ${v.readInLibrary} | ${v.unpublished} | ${v.self} | ${v.duplicates} |`
    );
  }
  md.push(
    `\nLatency ของ \`getRecommendations()\` (3 query พร้อมกัน + hydrate จาก Postgres, n=${s.latency.n}, ไม่นับ warm-up): p50 ${fmt(
      s.latency.p50,
      1
    )} ms · p95 ${fmt(s.latency.p95, 1)} ms · max ${fmt(s.latency.max, 1)} ms\n`
  );

  md.push(`## 2. Offline evaluation\n`);
  md.push(
    [
      `- แบ่งต่อผู้ใช้ตามเวลา: train / val ${CFG.splitShare.val * 100}% / test ${CFG.splitShare.test * 100}% (ผู้ใช้ที่มีรีวิว < 3 อยู่ใน train อย่างเดียว) — รีวิว train ${offline.splitSizes.train}, val ${offline.splitSizes.val}, test ${offline.splitSizes.test}`,
      `- relevant = รีวิวใน split ที่ rating >= ${CFG.relevantMinRating} (ระบบใช้สัญญาณรีวิวอย่างเดียว จึงใช้ rating แบบ explicit) · gain ของ NDCG = rating`,
      `- ผู้ใช้ที่ถูกประเมิน: val ${offline.evalUsers.val} คน, test ${offline.evalUsers.test} คน (ต้องมี relevant อย่างน้อย 1 เรื่องใน split) · ผู้ใช้ที่มีรีวิว >= ${CFG.minInteractionsForSignificance} รายการ ${offline.activeUsers} คน`,
      `- ความคล้าย/เพื่อนบ้าน/candidate/popularity คำนวณจาก **train เท่านั้น** ทั้งตอนวัด val และ test · ตอนวัด test ตัดเรื่องใน train+val ของผู้ใช้ออก`,
      `- \`cf-threshold\` = กฎของ Q2 ตรงตามระบบ (เพื่อนบ้านทุกคนที่ผ่าน threshold) · \`cf-threshold-top${CFG.topNNeighbors}\` = เก็บเพื่อนบ้าน ${CFG.topNNeighbors} คนที่มีเรื่องร่วมผ่านเกณฑ์มากที่สุด`,
      `- ระบบจริงไม่เรียงลำดับผล Q2 — การประเมินนี้เรียงตามจำนวนเพื่อนบ้านที่แนะนำเรื่องนั้น (เสมอกันใช้ popularity ใน train) เพื่อให้วัด @K ได้`,
      `- user coverage = สัดส่วนผู้ใช้ที่ได้คำแนะนำอย่างน้อย 1 เรื่อง · catalog coverage = เรื่องที่ถูกแนะนำอย่างน้อยครั้งหนึ่ง / นิยาย published ทั้งหมด (${ctx.counts.rows[1].postgres})`,
    ].join("\n") + "\n"
  );
  md.push(`### Validation\n\n${metricsTable(offline.rows.filter((r) => r.split === "val"))}\n`);
  md.push(`### Test\n\n${metricsTable(offline.rows.filter((r) => r.split === "test"))}\n`);

  md.push(`## 3. เลือก threshold\n`);
  md.push(`กฎ: NDCG@10 สูงสุดบน **val** ในกลุ่ม collaborative ที่ user coverage >= ${pct(CFG.minUserCoverage)}\n`);
  if (sel.best) {
    const t = testOf(sel.best)!;
    md.push(
      `**เลือก: \`${sel.best.method}\` threshold = ${sel.best.threshold}** (val NDCG@10 ${fmt(sel.best.ndcg)}, coverage ${pct(sel.best.user_coverage)})\n`
    );
    md.push(
      `บน test: NDCG@10 ${fmt(t.ndcg)} · Precision@10 ${fmt(t.precision)} · Recall@10 ${fmt(t.recall)} · HitRate@10 ${fmt(t.hit_rate)} · coverage ${pct(
        t.user_coverage
      )} — เทียบ popularity NDCG@10 ${fmt(popTest.ndcg)} (${t.ndcg >= popTest.ndcg ? "ดีกว่าหรือเท่า" : "แย่กว่า"} baseline)\n`
    );
  } else {
    md.push(`**ไม่มี threshold ใดผ่านเกณฑ์ user coverage >= ${pct(CFG.minUserCoverage)} บน val**\n`);
    if (sel.bestCoverage) {
      md.push(
        `coverage สูงสุดคือ \`${sel.bestCoverage.method}\` threshold ${sel.bestCoverage.threshold}: ${pct(sel.bestCoverage.user_coverage)} (NDCG@10 ${fmt(
          sel.bestCoverage.ndcg
        )})\n`
      );
    }
  }

  md.push(`## ข้อจำกัด\n`);
  md.push(
    [
      "- แบ่งตามเวลา **ต่อผู้ใช้** ตามที่กำหนด — train ของผู้ใช้คนหนึ่งอาจเกิดหลัง test ของอีกคน (รั่วข้ามผู้ใช้ตามเวลาได้เล็กน้อย) ถ้าต้องการเข้มงวดกว่านี้ควรตัดด้วยเวลาเดียวทั้งระบบ",
      "- ข้อมูลชุด `@scale.buddybook.local` เป็นข้อมูลจำลอง: sentiment_score ถูกสร้างจาก rating + noise เล็กน้อย จึงสัมพันธ์กับ rating สูงกว่าข้อมูลจริงจาก NLP",
      "- ประเมินเฉพาะ Q2 (collaborative) ที่มี threshold — Q1 (content-based) และ Q3 (underrated) ตรวจแค่ความถูกต้องในข้อ 1.3",
    ].join("\n") + "\n"
  );
  fs.writeFileSync(path.join(OUT_DIR, "recommender-eval.md"), md.join("\n") + "\n");
  return sel;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const startedAt = new Date();
  const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  const { neo4jDriver } = await import("@/lib/neo4j");
  const session = neo4jDriver.session({
    defaultAccessMode: neo4j.session.READ,
    ...(process.env.NEO4J_DATABASE ? { database: process.env.NEO4J_DATABASE } : {}),
  });
  const dbLabel = `${roUrl.hostname}:${roUrl.port}${roUrl.pathname}`;

  try {
    const before = { pg: await pgFingerprint(prisma), neo4j: await graphFingerprint(session) };
    console.log(`[eval] โหลดข้อมูลจาก ${dbLabel} ...`);
    const pg = await loadPostgres(prisma);
    console.log(`[eval] ผู้ใช้ ${pg.users.length}, นิยาย published ${pg.published.size}, รีวิว ${pg.reviews.length}`);

    console.log("[eval] 1.1 เทียบจำนวน Postgres vs Neo4j");
    const counts = await compareCounts(session, pg);
    console.log("[eval] 1.2 เทียบความคล้าย 20 คู่");
    const pairs = await compareSimilarity(session, pg);
    console.log("[eval] 1.3 ตรวจคำแนะนำจริง + latency");
    const sanity = await checkLiveRecommendations(pg);
    console.log("[eval] 2. offline eval");
    const t = performance.now();
    const offline = offlineEval(pg);
    console.log(`[eval]    เสร็จใน ${((performance.now() - t) / 1000).toFixed(1)} วินาที`);

    const after = { pg: await pgFingerprint(prisma), neo4j: await graphFingerprint(session) };
    const unchanged = {
      postgres: JSON.stringify(before.pg) === JSON.stringify(after.pg),
      neo4j: JSON.stringify(before.neo4j) === JSON.stringify(after.neo4j),
    };
    const sel = writeOutputs({ startedAt, counts, pairs, sanity, offline, unchanged, dbLabel });

    console.log(`[eval] เขียน ${path.relative(process.cwd(), path.join(OUT_DIR, "recommender-eval.md"))} และ .csv แล้ว`);
    if (offline.activeUsers < CFG.minUsersForSignificance) console.warn("[eval] ⚠️ ผู้ใช้ที่มี interaction >= 5 น้อยกว่า 30 คน — ผลไม่มีนัยทางสถิติ");
    console.log(
      sel.best
        ? `[eval] threshold ที่เลือก: ${sel.best.method} @ ${sel.best.threshold} (val NDCG@10 ${fmt(sel.best.ndcg)}, coverage ${pct(sel.best.user_coverage)})`
        : "[eval] ไม่มี threshold ที่ผ่านเกณฑ์ coverage"
    );
    if (!unchanged.postgres || !unchanged.neo4j) throw new Error("ข้อมูลเปลี่ยนระหว่างรัน — ตรวจสอบด่วน");
  } finally {
    await session.close();
    await neo4jDriver.close();
    await prisma.$disconnect();
    const { prisma: appPrisma } = await import("@/lib/prisma");
    await appPrisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
