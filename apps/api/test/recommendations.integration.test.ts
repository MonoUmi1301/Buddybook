import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { createHarness } from "./helpers";

/**
 * Integration — Recommendation v2 (gap 2.3) + sentiment polarity callback (gap 2.1)
 * CI ไม่มี Neo4j — ทดสอบเส้นทาง degrade ที่ต้องยังจัดอันดับจาก Postgres ได้ (fresh + popular fallback)
 */
const h = createHarness("rec");
let reader: { id: string; token: string };
let author: { id: string; token: string };
let tagId: number;
const novels: Record<string, string> = {};

async function novel(key: string, data: { tagged?: boolean; mature?: boolean; ageDays?: number; views?: number; ownedByReader?: boolean }) {
  const n = await prisma.novel.create({
    data: {
      author_id: data.ownedByReader ? reader.id : author.id,
      title: `rec ${key} ${h.tag}`,
      visibility: "published",
      content_rating: data.mature ? "mature" : "all_ages",
      view_count: data.views ?? 0,
      created_at: new Date(Date.now() - (data.ageDays ?? 0) * 86_400_000),
      ...(data.tagged ? { novel_tags: { create: { tag_id: tagId } } } : {}),
    },
    select: { novel_id: true },
  });
  novels[key] = n.novel_id;
  return n.novel_id;
}

beforeAll(async () => {
  reader = await h.createUser("reader");
  author = await h.createUser("author");
  const tag = await prisma.tag.create({ data: { name: `rec-tag-${h.tag}` }, select: { tag_id: true } });
  tagId = tag.tag_id;
  await prisma.userInterest.create({ data: { user_id: reader.id, tag_id: tagId } });

  await novel("fresh", { tagged: true, ageDays: 2 });
  await novel("popular_old", { tagged: true, ageDays: 400, views: 50_000 });
  await novel("mature", { tagged: true, mature: true, ageDays: 1 });
  await novel("own", { tagged: true, ageDays: 1, ownedByReader: true });
  const readId = await novel("already_read", { tagged: true, ageDays: 1 });
  await prisma.readingProgress.create({ data: { user_id: reader.id, novel_id: readId, last_chapter_number: 1 } });
  await h.start();
});

afterAll(async () => {
  await prisma.readingProgress.deleteMany({ where: { user_id: reader.id } });
  await h.stop();
  await prisma.tag.deleteMany({ where: { tag_id: tagId } });
  await prisma.$disconnect();
});

describe("GET /recommendations (v2)", () => {
  it("ranks Postgres candidates with reasons even when the graph is unavailable", async () => {
    const res = await h.api("GET", "/recommendations?limit=50", reader.token);
    expect(res.status).toBe(200);
    const ids = res.json.items.map((i: { novel_id: string }) => i.novel_id);

    expect(ids).toContain(novels.fresh);
    expect(ids).toContain(novels.popular_old);
    expect(ids).not.toContain(novels.mature); // reader ยังไม่ยืนยันอายุ
    expect(ids).not.toContain(novels.own);
    expect(ids).not.toContain(novels.already_read);

    const fresh = res.json.items.find((i: { novel_id: string }) => i.novel_id === novels.fresh);
    expect(fresh.reason).toBe("fresh");
    expect(typeof fresh.score).toBe("number");
    expect(typeof fresh.is_long_tail).toBe("boolean");
    expect(res.json.meta).toHaveProperty("long_tail_share");
    // ยังคง key เดิมไว้ให้ client รุ่นเก่า
    expect(Array.isArray(res.json.content_based)).toBe(true);
  });

  it("ranks a fresh on-interest novel above an old popular one (popularity is not a positive signal)", async () => {
    const res = await h.api("GET", "/recommendations?limit=50", reader.token);
    const ids: string[] = res.json.items.map((i: { novel_id: string }) => i.novel_id);
    expect(ids.indexOf(novels.fresh)).toBeLessThan(ids.indexOf(novels.popular_old));
  });

  it("validates the limit", async () => {
    expect((await h.api("GET", "/recommendations?limit=0", reader.token)).status).toBe(400);
  });
});

describe("POST /internal/nlp/sentiment-callback (polarity)", () => {
  it("stores a confident negative review as a negative polarity", async () => {
    const review = await prisma.review.create({
      data: { novel_id: novels.popular_old, user_id: reader.id, rating: 1, comment_text: "แย่มาก" },
      select: { review_id: true },
    });
    const res = await h.api(
      "POST",
      "/internal/nlp/sentiment-callback",
      undefined,
      { target_type: "review", target_id: review.review_id, sentiment_label: "neg", sentiment_score: 0.97 },
      { "x-internal-token": env.INTERNAL_SERVICE_TOKEN }
    );
    expect(res.status).toBe(200);
    expect(res.json.sentiment_polarity).toBeCloseTo(-0.97);
    const stored = await prisma.review.findUniqueOrThrow({ where: { review_id: review.review_id } });
    expect(stored.sentiment_polarity).toBeCloseTo(-0.97);
    expect(stored.sentiment_score).toBeCloseTo(0.97);
  });

  it("accepts an explicit polarity from newer workers", async () => {
    const chapter = await prisma.chapter.create({
      data: { novel_id: novels.fresh, chapter_number: 1, title: "c1", content: "<p>x</p>", status: "published" },
      select: { chapter_id: true },
    });
    const comment = await prisma.comment.create({
      data: { chapter_id: chapter.chapter_id, user_id: reader.id, content: "ชอบนะแต่..." },
      select: { comment_id: true },
    });
    const res = await h.api(
      "POST",
      "/internal/nlp/sentiment-callback",
      undefined,
      { target_type: "comment", target_id: comment.comment_id, sentiment_label: "pos", sentiment_score: 0.6, sentiment_polarity: 0.25 },
      { "x-internal-token": env.INTERNAL_SERVICE_TOKEN }
    );
    expect(res.status).toBe(200);
    expect(res.json.sentiment_polarity).toBe(0.25);
  });
});
