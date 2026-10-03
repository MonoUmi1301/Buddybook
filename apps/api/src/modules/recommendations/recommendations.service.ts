import neo4j from "neo4j-driver";
import { NEO4J_READ_TIMEOUT_MS, withNeo4jSession } from "@/lib/neo4j";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { env } from "@/config/env";
import { isViewerAgeVerified } from "@/lib/contentRating";
import {
  type Candidate,
  type CandidateSource,
  type RecommendationReason,
  longTailShare,
  mergeCandidates,
  primaryReason,
  relevanceScore,
  rerankLongTail,
} from "@/modules/recommendations/ranking";

/** จำนวน candidate สูงสุดที่ดึงจากแต่ละแหล่ง (ก่อนจัดอันดับ) */
const CANDIDATES_PER_SOURCE = 40;
export const DEFAULT_RECOMMENDATION_LIMIT = 10;

interface RecommendedNovel {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  view_count: number;
  author: { username: string; pen_name: string | null };
  reason: RecommendationReason;
  score: number;
  is_long_tail: boolean;
}

function blank(novel_id: string, source: CandidateSource): Candidate {
  return {
    novel_id,
    sources: new Set([source]),
    shared_tags: 0,
    similar_supporters: 0,
    avg_polarity: null,
    view_count: 0,
    created_at: new Date(0),
  };
}

/** candidate จาก Neo4j — interest / similar_readers / hidden_gem (ล่มแล้วคืน [] + degraded=true) */
async function graphCandidates(user_id: string): Promise<{ candidates: Candidate[]; degraded: boolean }> {
  try {
    const read = (cypher: string) =>
      withNeo4jSession((session) =>
        session.run(cypher, { user_id, limit: neo4jInt(CANDIDATES_PER_SOURCE) }, { timeout: NEO4J_READ_TIMEOUT_MS })
      );

    // Q1 — Content-based: นับแท็กที่ตรงกับความสนใจ (เดิม LIMIT 10 ไม่จัดอันดับ ได้ลำดับสุ่มตามกราฟ)
    const interestQ = read(
      `MATCH (u:User {user_id: $user_id})-[:INTERESTED_IN]->(t:Tag)<-[:HAS_TAG]-(n:Novel)
       WHERE NOT (u)-[:READ]->(n)
       RETURN n.novel_id AS novel_id, count(DISTINCT t) AS shared
       ORDER BY shared DESC
       LIMIT $limit`
    );

    // Q2 — Collaborative + sentiment: ผู้อ่านที่มีขั้วความรู้สึกต่อเรื่องเดียวกันใกล้กัน (±0.3 บนสเกล −1..1)
    // แล้วชอบเรื่องอื่น (ขั้ว > 0.3) ที่เรายังไม่อ่าน — นับจำนวนคนที่สนับสนุนเป็นความแรงของสัญญาณ
    const collabQ = read(
      `MATCH (me:User {user_id: $user_id})-[r1:READ]->(shared:Novel)<-[r2:READ]-(peer:User)
       WHERE peer <> me AND r1.sentiment_score IS NOT NULL AND r2.sentiment_score IS NOT NULL
         AND abs(r1.sentiment_score - r2.sentiment_score) <= 0.3
       WITH me, collect(DISTINCT peer) AS peers
       UNWIND peers AS peer
       MATCH (peer)-[r3:READ]->(cand:Novel)
       WHERE r3.sentiment_score > 0.3 AND NOT (me)-[:READ]->(cand)
       RETURN cand.novel_id AS novel_id, count(DISTINCT peer) AS supporters
       ORDER BY supporters DESC
       LIMIT $limit`
    );

    // Q3 — Hidden gem: ขั้วความรู้สึกเฉลี่ยดี (≥ 0.3) เรียงจากคนอ่านน้อยก่อน (ลด popularity bias)
    const gemQ = read(
      `MATCH (:User)-[r:READ]->(n:Novel)
       WHERE r.sentiment_score IS NOT NULL
         AND NOT (:User {user_id: $user_id})-[:READ]->(n)
       WITH n, count(r) AS readers, avg(r.sentiment_score) AS avg_polarity
       WHERE avg_polarity >= 0.3
       RETURN n.novel_id AS novel_id, avg_polarity
       ORDER BY readers ASC, avg_polarity DESC
       LIMIT $limit`
    );

    const [interest, collab, gem] = await Promise.all([interestQ, collabQ, gemQ]);
    const out: Candidate[] = [];
    for (const r of interest.records) {
      const c = blank(r.get("novel_id"), "interest");
      c.shared_tags = toNum(r.get("shared"));
      out.push(c);
    }
    for (const r of collab.records) {
      const c = blank(r.get("novel_id"), "similar_readers");
      c.similar_supporters = toNum(r.get("supporters"));
      out.push(c);
    }
    for (const r of gem.records) {
      const c = blank(r.get("novel_id"), "hidden_gem");
      c.avg_polarity = toNum(r.get("avg_polarity"));
      out.push(c);
    }
    return { candidates: out, degraded: false };
  } catch (err) {
    console.error("Neo4j recommendation candidates failed, falling back to Postgres only:", err);
    return { candidates: [], degraded: true };
  }
}

/** Cypher LIMIT ต้องเป็น integer — JS number ถูกส่งเข้า driver เป็น float */
function neo4jInt(n: number) {
  return neo4j.int(Math.trunc(n));
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toNumber" in v) return (v as { toNumber(): number }).toNumber();
  return Number(v);
}

/**
 * GET /recommendations — Recommendation v2 (gap 2.3)
 * 1) candidate: Neo4j (interest / similar_readers / hidden_gem) + Postgres (fresh / popular fallback)
 * 2) กรองใน Postgres (source of truth): เผยแพร่อยู่, ไม่ใช่ของตัวเอง, ยังไม่เคยอ่าน, เกตอายุ 18+
 * 3) คำนวณแท็กที่ตรง + ขั้วความรู้สึกเฉลี่ยจาก Postgres ทุกตัว (Neo4j ล่มก็ยังจัดอันดับได้)
 * 4) relevanceScore → rerankLongTail → เหตุผลบนการ์ด
 */
export async function getRecommendations(user_id: string, limit = DEFAULT_RECOMMENDATION_LIMIT) {
  const now = new Date();
  const [interests, readRows, ageVerified, graph] = await Promise.all([
    prisma.userInterest.findMany({ where: { user_id }, select: { tag_id: true } }),
    prisma.readingProgress.findMany({ where: { user_id }, select: { novel_id: true } }),
    isViewerAgeVerified(user_id),
    graphCandidates(user_id),
  ]);
  const interestTagIds = interests.map((i) => i.tag_id);
  const readIds = readRows.map((r) => r.novel_id);

  const baseWhere: Prisma.NovelWhereInput = {
    visibility: "published",
    author_id: { not: user_id },
    novel_id: { notIn: readIds },
    author: { is_suspended: false },
    ...(ageVerified ? {} : { content_rating: { not: "mature" } }),
  };

  // Q4 — มาใหม่ตรงแนว: นิยายที่เพิ่งสร้างไม่มีทางมี sentiment/ยอดวิว จึงต้องมีช่องทางเข้าเองโดยตรง
  const freshSince = new Date(now.getTime() - env.RECS_FRESH_DAYS * 24 * 60 * 60 * 1000);
  const fresh = await prisma.novel.findMany({
    where: {
      ...baseWhere,
      created_at: { gte: freshSince },
      ...(interestTagIds.length > 0 ? { novel_tags: { some: { tag_id: { in: interestTagIds } } } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: CANDIDATES_PER_SOURCE,
    select: { novel_id: true },
  });

  let candidates = [...graph.candidates, ...fresh.map((n) => blank(n.novel_id, "fresh"))];

  // Cold start (ยังไม่มีกราฟ/ความสนใจ หรือ Neo4j ล่ม) — เสริมด้วยนิยายยอดนิยมที่ตรงแนว ให้หน้าแรกไม่ว่าง
  if (mergeCandidates(candidates).size < limit * 2) {
    const popular = await prisma.novel.findMany({
      where: {
        ...baseWhere,
        ...(interestTagIds.length > 0 ? { novel_tags: { some: { tag_id: { in: interestTagIds } } } } : {}),
      },
      orderBy: { view_count: "desc" },
      take: CANDIDATES_PER_SOURCE,
      select: { novel_id: true },
    });
    candidates = [...candidates, ...popular.map((n) => blank(n.novel_id, "popular"))];
  }

  const merged = mergeCandidates(candidates);
  if (merged.size === 0) {
    return { items: [], content_based: [], collaborative: [], underrated: [], meta: buildMeta([], graph.degraded) };
  }

  const ids = [...merged.keys()];
  const [novels, polarity, threshold] = await Promise.all([
    prisma.novel.findMany({
      where: { ...baseWhere, novel_id: { in: ids, notIn: readIds } },
      select: {
        novel_id: true,
        title: true,
        cover_image_url: true,
        view_count: true,
        created_at: true,
        author: { select: { username: true, pen_name: true } },
        novel_tags: { select: { tag_id: true } },
      },
    }),
    prisma.review.groupBy({
      by: ["novel_id"],
      where: { novel_id: { in: ids }, sentiment_polarity: { not: null } },
      _avg: { sentiment_polarity: true },
    }),
    getHeadViewThreshold(),
  ]);
  const polarityByNovel = new Map(polarity.map((p) => [p.novel_id, p._avg.sentiment_polarity]));
  const interestSet = new Set(interestTagIds);

  const scored = novels.map((n) => {
    const c = merged.get(n.novel_id)!;
    c.view_count = Number(n.view_count);
    c.created_at = n.created_at;
    c.shared_tags = n.novel_tags.filter((t) => interestSet.has(t.tag_id)).length;
    c.avg_polarity = polarityByNovel.get(n.novel_id) ?? c.avg_polarity;
    return {
      novel_id: n.novel_id,
      score: relevanceScore(c, { interest_count: interestTagIds.length, now }),
      long_tail: c.view_count < threshold,
    };
  });

  const ranked = rerankLongTail(scored, {
    k: limit,
    lambda: env.RECS_LONG_TAIL_LAMBDA,
    target_long_tail_share: env.RECS_LONG_TAIL_TARGET,
  });

  const novelMap = new Map(novels.map((n) => [n.novel_id, n]));
  const items: RecommendedNovel[] = ranked.map((r) => {
    const n = novelMap.get(r.novel_id)!;
    return {
      novel_id: n.novel_id,
      title: n.title,
      cover_image_url: n.cover_image_url,
      view_count: Number(n.view_count),
      author: n.author,
      reason: primaryReason(merged.get(r.novel_id)!, now),
      score: Math.round(r.score * 1000) / 1000,
      is_long_tail: r.long_tail,
    };
  });

  // คง 3 key เดิมไว้ให้ client เก่า (แยกตามแหล่งที่มา จากรายการที่จัดอันดับแล้ว)
  const bySource = (s: CandidateSource) => items.filter((i) => merged.get(i.novel_id)!.sources.has(s));
  return {
    items,
    content_based: bySource("interest"),
    collaborative: bySource("similar_readers"),
    underrated: bySource("hidden_gem"),
    meta: buildMeta(ranked, graph.degraded),
  };
}

function buildMeta(ranked: { long_tail: boolean }[], degraded: boolean) {
  return {
    long_tail_share: Math.round(longTailShare(ranked) * 100) / 100,
    rerank_lambda: env.RECS_LONG_TAIL_LAMBDA,
    graph_available: !degraded,
  };
}

/** ยอดวิวต่ำสุดของกลุ่ม head (20% บนสุดของนิยายที่เผยแพร่) — ต่ำกว่านี้คือ long-tail */
async function getHeadViewThreshold(): Promise<number> {
  const rows = await prisma.$queryRaw<{ threshold: bigint | null }[]>`
    SELECT percentile_disc(0.8) WITHIN GROUP (ORDER BY view_count) AS threshold
    FROM novels WHERE visibility = 'published'`;
  const t = rows[0]?.threshold;
  // ทุกเรื่องยอดวิว 0 เท่ากัน → threshold 0 → ไม่มี long-tail เลย; ให้ทุกเรื่องนับเป็น long-tail แทน
  return t === null || t === undefined || Number(t) === 0 ? 1 : Number(t);
}

/**
 * Reference implementation — POST /internal/recommendations/sync
 * รี-sync ข้อมูลทั้งหมดจาก PostgreSQL เข้า Neo4j ใหม่ทั้งกราฟ (ใช้ตอน backfill/seed ครั้งแรก
 * หรือซ่อม drift ระหว่างสอง store) endpoint ที่ mutation จริงเรียก sync เฉพาะจุดของตัวเองอยู่แล้ว
 * gap 2.2 — READ edge มาจากประวัติการอ่าน + รีวิว + คอมเมนต์ (เดิมรีวิวอย่างเดียว) และ
 * sentiment_score คือขั้วความรู้สึกรวม −1..1 (lib/sentiment.ts combinePolarity)
 */
export async function fullResync() {
  const { syncUserNode, syncInterestedIn, syncNovelTags, syncReadEdge } = await import("@/lib/graphSync");
  const { combinePolarity } = await import("@/lib/sentiment");

  const users = await prisma.user.findMany({ select: { user_id: true, username: true } });
  for (const u of users) await syncUserNode(u.user_id, u.username);

  const interests = await prisma.userInterest.findMany({
    select: { user_id: true, tag: { select: { name: true } } },
  });
  const interestsByUser = new Map<string, string[]>();
  for (const i of interests) {
    const list = interestsByUser.get(i.user_id) ?? [];
    list.push(i.tag.name);
    interestsByUser.set(i.user_id, list);
  }
  const usernameById = new Map(users.map((u) => [u.user_id, u.username]));
  for (const [user_id, tagNames] of interestsByUser) {
    await syncInterestedIn(user_id, usernameById.get(user_id) ?? "", tagNames);
  }

  const novels = await prisma.novel.findMany({
    where: { visibility: "published" },
    select: { novel_id: true, title: true, novel_tags: { select: { tag: { select: { name: true } } } } },
  });
  for (const n of novels) {
    await syncNovelTags(
      n.novel_id,
      n.title,
      n.novel_tags.map((nt) => nt.tag.name)
    );
  }
  const publishedIds = new Set(novels.map((n) => n.novel_id));

  // รวม READ ต่อคู่ (user, novel) จาก 3 แหล่ง
  const [progress, reviews, comments] = await Promise.all([
    prisma.readingProgress.findMany({ select: { user_id: true, novel_id: true, last_chapter_number: true, last_read_at: true } }),
    prisma.review.findMany({ select: { user_id: true, novel_id: true, sentiment_polarity: true } }),
    prisma.comment.findMany({
      where: { sentiment_polarity: { not: null } },
      select: { user_id: true, sentiment_polarity: true, chapter: { select: { novel_id: true } } },
    }),
  ]);
  interface Pair {
    user_id: string;
    novel_id: string;
    review: number | null;
    comments: number[];
    progress?: { last_chapter_number: number; last_read_at: Date };
  }
  const pairs = new Map<string, Pair>();
  const pair = (user_id: string, novel_id: string) => {
    const key = `${user_id}:${novel_id}`;
    let p = pairs.get(key);
    if (!p) {
      p = { user_id, novel_id, review: null, comments: [] };
      pairs.set(key, p);
    }
    return p;
  };
  for (const p of progress) pair(p.user_id, p.novel_id).progress = { last_chapter_number: p.last_chapter_number, last_read_at: p.last_read_at };
  for (const r of reviews) pair(r.user_id, r.novel_id).review = r.sentiment_polarity;
  for (const c of comments) pair(c.user_id, c.chapter.novel_id).comments.push(c.sentiment_polarity as number);

  let readEdges = 0;
  for (const p of pairs.values()) {
    if (!publishedIds.has(p.novel_id)) continue;
    await syncReadEdge(p.user_id, p.novel_id, combinePolarity(p.review, p.comments), p.progress);
    readEdges += 1;
  }

  return {
    users_synced: users.length,
    novels_synced: novels.length,
    reviews_synced: reviews.length,
    read_edges_synced: readEdges,
  };
}
