import { describe, expect, it } from "vitest";
import {
  type Candidate,
  headThreshold,
  longTailShare,
  mergeCandidates,
  primaryReason,
  relevanceScore,
  rerankLongTail,
} from "@/modules/recommendations/ranking";
import { combinePolarity, toPolarity } from "@/lib/sentiment";

const now = new Date("2026-10-01T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

function cand(over: Partial<Candidate> = {}): Candidate {
  return {
    novel_id: "n",
    sources: new Set(["interest"]),
    shared_tags: 0,
    similar_supporters: 0,
    avg_polarity: null,
    view_count: 0,
    created_at: daysAgo(365),
    ...over,
  };
}

describe("toPolarity (gap 2.1)", () => {
  it("maps a confident negative label to a strongly negative polarity", () => {
    expect(toPolarity("neg", 0.98)).toBeCloseTo(-0.98);
    expect(toPolarity("pos", 0.9)).toBeCloseTo(0.9);
    expect(toPolarity("neutral", 0.99)).toBe(0);
  });

  it("clamps out-of-range confidence", () => {
    expect(toPolarity("pos", 1.5)).toBe(1);
    expect(toPolarity("neg", -0.2)).toBe(-0);
  });
});

describe("combinePolarity (gap 2.2)", () => {
  it("returns null when nothing has been analysed yet", () => {
    expect(combinePolarity(null, [])).toBeNull();
  });

  it("uses whichever signal exists", () => {
    expect(combinePolarity(0.8, [])).toBe(0.8);
    expect(combinePolarity(null, [0.2, 0.4])).toBeCloseTo(0.3);
  });

  it("weights the review above the comment mean", () => {
    expect(combinePolarity(1, [-1])).toBeCloseTo(0.6 * 1 + 0.4 * -1);
  });
});

describe("relevanceScore", () => {
  const ctx = { interest_count: 3, now };

  it("does not use popularity as a positive signal", () => {
    expect(relevanceScore(cand({ view_count: 1_000_000 }), ctx)).toBe(relevanceScore(cand({ view_count: 0 }), ctx));
  });

  it("ranks a disliked novel below an unknown one, and a liked one above both", () => {
    const disliked = relevanceScore(cand({ avg_polarity: -0.9 }), ctx);
    const unknown = relevanceScore(cand({ avg_polarity: null }), ctx);
    const liked = relevanceScore(cand({ avg_polarity: 0.9 }), ctx);
    expect(disliked).toBeLessThan(unknown);
    expect(unknown).toBeLessThan(liked);
  });

  it("rewards tag overlap, similar readers and freshness", () => {
    const base = relevanceScore(cand(), ctx);
    expect(relevanceScore(cand({ shared_tags: 2 }), ctx)).toBeGreaterThan(base);
    expect(relevanceScore(cand({ similar_supporters: 2 }), ctx)).toBeGreaterThan(base);
    expect(relevanceScore(cand({ created_at: daysAgo(1) }), ctx)).toBeGreaterThan(base);
  });

  it("stays within 0..1", () => {
    const best = relevanceScore(cand({ shared_tags: 9, similar_supporters: 9, avg_polarity: 1, created_at: now }), ctx);
    expect(best).toBeLessThanOrEqual(1);
    expect(best).toBeGreaterThan(0.99);
  });
});

describe("headThreshold", () => {
  it("puts the top 20% by views in the head", () => {
    const views = [1000, 900, 50, 40, 30, 20, 10, 5, 2, 1];
    const t = headThreshold(views);
    expect(views.filter((v) => v >= t)).toEqual([1000, 900]);
  });
});

describe("rerankLongTail", () => {
  const items = [
    { novel_id: "h1", score: 0.9, long_tail: false },
    { novel_id: "h2", score: 0.88, long_tail: false },
    { novel_id: "h3", score: 0.86, long_tail: false },
    { novel_id: "h4", score: 0.84, long_tail: false },
    { novel_id: "t1", score: 0.8, long_tail: true },
    { novel_id: "t2", score: 0.78, long_tail: true },
    { novel_id: "t3", score: 0.1, long_tail: true },
  ];

  it("with lambda 0 is a plain sort by score", () => {
    expect(rerankLongTail(items, { k: 4, lambda: 0, target_long_tail_share: 0.5 }).map((i) => i.novel_id)).toEqual([
      "h1",
      "h2",
      "h3",
      "h4",
    ]);
  });

  it("raises the long-tail share towards the target", () => {
    const out = rerankLongTail(items, { k: 4, lambda: 0.3, target_long_tail_share: 0.5 });
    expect(longTailShare(out)).toBeGreaterThanOrEqual(0.5);
    expect(out[0].novel_id).toBe("h1");
  });

  it("does not promote irrelevant long-tail items over close head items", () => {
    const out = rerankLongTail(items, { k: 6, lambda: 0.3, target_long_tail_share: 0.5 });
    expect(out.map((i) => i.novel_id)).not.toContain("t3");
  });
});

describe("mergeCandidates / primaryReason", () => {
  it("merges sources and keeps the strongest signals", () => {
    const merged = mergeCandidates([
      cand({ novel_id: "a", sources: new Set(["interest"]), shared_tags: 2 }),
      cand({ novel_id: "a", sources: new Set(["similar_readers"]), similar_supporters: 4 }),
    ]);
    const a = merged.get("a")!;
    expect([...a.sources].sort()).toEqual(["interest", "similar_readers"]);
    expect(a.shared_tags).toBe(2);
    expect(a.similar_supporters).toBe(4);
    expect(primaryReason(a, now)).toBe("similar_readers");
  });

  it("only labels a novel as fresh while it is actually new", () => {
    expect(primaryReason(cand({ sources: new Set(["fresh", "interest"]), created_at: daysAgo(2) }), now)).toBe("fresh");
    expect(primaryReason(cand({ sources: new Set(["fresh", "interest"]), created_at: daysAgo(40) }), now)).toBe("interest");
  });
});
