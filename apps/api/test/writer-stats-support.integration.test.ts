import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetRateLimits } from "@/middleware/rateLimit.middleware";
import { resetViewDedupe, thaiDay } from "@/lib/viewTracking";
import { topKeywords, tokenize } from "@/lib/keywords";
import { createHarness } from "./helpers";

/** Integration — gap 3.1 สถิตินักเขียน + ยอดวิว, 3.5 social listening, 3.2 แจ้งปัญหา, 3.3 แจ้งเตือน */
const h = createHarness("s3");
let author: { id: string; token: string };
let reader: { id: string; token: string };
let reader2: { id: string; token: string };
let admin: { id: string; token: string };
let novelId: string;
const chapterIds: string[] = [];

beforeAll(async () => {
  author = await h.createUser("author");
  reader = await h.createUser("reader");
  reader2 = await h.createUser("reader2");
  admin = await h.createUser("admin", { role: "admin" });
  const novel = await prisma.novel.create({
    data: { author_id: author.id, title: `สถิติ ${h.tag}`, visibility: "published" },
    select: { novel_id: true },
  });
  novelId = novel.novel_id;
  for (const n of [1, 2, 3]) {
    const c = await prisma.chapter.create({
      data: { novel_id: novelId, chapter_number: n, title: `ตอน ${n}`, content: "<p>x</p>", status: "published" },
      select: { chapter_id: true },
    });
    chapterIds.push(c.chapter_id);
  }
  await h.start();
});

afterAll(async () => {
  await prisma.supportTicket.deleteMany({ where: { user_id: { in: h.userIds } } });
  await prisma.readingProgress.deleteMany({ where: { user_id: { in: h.userIds } } });
  await h.stop();
  await prisma.$disconnect();
});

beforeEach(() => resetRateLimits());

const settle = () => new Promise((r) => setTimeout(r, 150)); // งานนับวิว/ความคืบหน้าเป็น fire-and-forget

describe("chapter view tracking", () => {
  it("counts each reader once per chapter per day, never the author", async () => {
    resetViewDedupe();
    await h.api("GET", `/chapters/${chapterIds[0]}`, reader.token);
    await h.api("GET", `/chapters/${chapterIds[0]}`, reader.token); // รีเฟรช — ไม่นับซ้ำ
    await h.api("GET", `/chapters/${chapterIds[0]}`, reader2.token);
    await h.api("GET", `/chapters/${chapterIds[1]}`, reader.token);
    await h.api("GET", `/chapters/${chapterIds[0]}`, author.token); // เจ้าของ — ไม่นับ
    await h.api("GET", `/chapters/${chapterIds[0]}`, undefined, undefined, { "X-Forwarded-For": "203.0.113.9" }); // ผู้อ่านไม่ล็อกอิน
    await settle();

    const rows = await prisma.chapterViewDaily.findMany({ where: { novel_id: novelId } });
    const byChapter = Object.fromEntries(rows.map((r) => [r.chapter_id, r.views]));
    expect(byChapter[chapterIds[0]]).toBe(3);
    expect(byChapter[chapterIds[1]]).toBe(1);
    const novel = await prisma.novel.findUniqueOrThrow({ where: { novel_id: novelId } });
    expect(Number(novel.view_count)).toBe(4);
  });
});

describe("writer stats", () => {
  beforeAll(async () => {
    const c1 = await prisma.comment.create({
      data: { chapter_id: chapterIds[0], user_id: reader.id, content: "พล็อตสนุก ตัวละครน่ารัก", sentiment_label: "pos", sentiment_score: 0.9, sentiment_polarity: 0.9 },
    });
    await prisma.comment.create({
      data: { chapter_id: chapterIds[1], user_id: reader2.id, content: "พล็อตสนุก แต่จบเร็ว", sentiment_label: "pos", sentiment_score: 0.7, sentiment_polarity: 0.5 },
    });
    await prisma.comment.create({
      data: { chapter_id: chapterIds[1], user_id: reader.id, content: "ตอนนี้ยืดเยื้อ น่าเบื่อ", sentiment_label: "neg", sentiment_score: 0.8, sentiment_polarity: -0.8 },
    });
    // คอมเมนต์ของนักเขียนเอง — ต้องไม่ถูกนับ
    await prisma.comment.create({ data: { chapter_id: chapterIds[0], user_id: author.id, content: "ขอบคุณที่อ่านนะคะ", parent_comment_id: c1.comment_id } });
    await prisma.review.create({ data: { novel_id: novelId, user_id: reader.id, rating: 4, comment_text: "สนุกดี", sentiment_label: "pos", sentiment_score: 0.9, sentiment_polarity: 0.9 } });
  });

  it("returns totals, a zero-filled daily series, chapter retention and sentiment", async () => {
    const res = await h.api("GET", `/me/stats/novels/${novelId}?days=7`, author.token);
    expect(res.status).toBe(200);
    const s = res.json;
    expect(s.totals).toMatchObject({ views: 4, readers: 2, comments: 3, reviews: 1, avg_rating: 4 });
    expect(s.daily_views).toHaveLength(7);
    expect(s.daily_views.at(-1)).toEqual({ day: thaiDay(), views: 4 });
    expect(s.daily_views[0].views).toBe(0);

    const [ch1, ch2, ch3] = s.chapters;
    expect(ch1).toMatchObject({ chapter_number: 1, views: 3, comments: 1, readers_reached: 2 });
    expect(ch2).toMatchObject({ chapter_number: 2, views: 1, comments: 2, readers_reached: 1 });
    expect(ch3).toMatchObject({ chapter_number: 3, views: 0, readers_reached: 0 });

    expect(s.sentiment.counts).toEqual({ pos: 3, neg: 1, neutral: 0, pending: 0 });
    expect(s.sentiment.avg_polarity).toBeCloseTo((0.9 + 0.5 - 0.8 + 0.9) / 4, 1);
    expect(s.sentiment.weekly).toHaveLength(8);
    expect(s.keywords.positive.map((k: { term: string }) => k.term)).toContain("พล็อต");
  });

  it("is only visible to the author", async () => {
    expect((await h.api("GET", `/me/stats/novels/${novelId}`, reader.token)).status).toBe(403);
    expect((await h.api("GET", `/me/stats/novels/${novelId}?days=5`, author.token)).status).toBe(400);
  });

  it("lists an overview of my novels", async () => {
    const res = await h.api("GET", "/me/stats/novels", author.token);
    expect(res.status).toBe(200);
    expect(res.json.novels).toHaveLength(1);
    expect(res.json.novels[0]).toMatchObject({ novel_id: novelId, views: 4, views_7d: 4, readers: 2, chapters: 3 });
  });
});

describe("keywords", () => {
  it("tokenizes Thai and drops stopwords", () => {
    expect(tokenize("<p>ชอบพล็อตมากๆ เลย</p>")).toEqual(expect.arrayContaining(["ชอบ", "พล็อต"]));
    expect(tokenize("และ ที่ ครับ")).toEqual([]);
  });

  it("counts a term once per message", () => {
    expect(topKeywords(["สนุก สนุก สนุก", "สนุกมาก"], 5, 1)).toEqual([{ term: "สนุก", count: 2 }]);
  });
});

describe("support tickets", () => {
  let ticketId: string;

  it("lets a user open a ticket and see only their own", async () => {
    const res = await h.api("POST", "/support/tickets", reader.token, {
      category: "payment",
      subject: "เติมเงินแล้วเหรียญไม่เข้า",
      body: "โอนไปเมื่อเช้า 100 บาท แต่ยอดเหรียญไม่เพิ่ม",
    });
    expect(res.status).toBe(201);
    ticketId = res.json.ticket_id;
    expect(res.json.status).toBe("open");

    expect((await h.api("GET", `/support/tickets/${ticketId}`, reader2.token)).status).toBe(404);
    const mine = await h.api("GET", "/support/tickets", reader.token);
    expect(mine.json.tickets.map((t: { ticket_id: string }) => t.ticket_id)).toEqual([ticketId]);
  });

  it("rejects attachments that are not uploaded through the platform", async () => {
    const res = await h.api("POST", `/support/tickets/${ticketId}/messages`, reader.token, {
      body: "แนบสลิป",
      attachment_url: "https://evil.example.com/x.png",
    });
    expect(res.status).toBe(400);
  });

  it("notifies the user when staff reply, hides the staff identity, and moves the status", async () => {
    const queue = await h.api("GET", "/admin/support/tickets", admin.token);
    expect(queue.json.tickets.find((t: { ticket_id: string }) => t.ticket_id === ticketId)).toMatchObject({ awaiting_staff: true });
    expect((await h.api("GET", "/admin/support/tickets", reader.token)).status).toBe(403);

    const reply = await h.api("POST", `/support/tickets/${ticketId}/messages`, admin.token, { body: "ตรวจสอบแล้ว เติมให้เรียบร้อยค่ะ" });
    expect(reply.status).toBe(201);
    expect(reply.json.is_staff).toBe(true);

    const detail = await h.api("GET", `/support/tickets/${ticketId}`, reader.token);
    expect(detail.json.status).toBe("in_progress");
    expect(detail.json.messages).toHaveLength(2);
    expect(detail.json.messages[1].author).toBeNull();
    expect(detail.json.user.email).toBeUndefined();

    const notes = await prisma.notification.findMany({ where: { user_id: reader.id, type: "support_reply" } });
    expect(notes).toHaveLength(1);
    expect(notes[0].link_url).toBe(`/support/${ticketId}`);
  });

  it("lets the owner close but not resolve, and staff resolve", async () => {
    expect((await h.api("PATCH", `/support/tickets/${ticketId}/status`, reader.token, { status: "resolved" })).status).toBe(403);
    expect((await h.api("PATCH", `/support/tickets/${ticketId}/status`, admin.token, { status: "resolved" })).status).toBe(200);
    // ผู้ใช้ตอบกลับเรื่องที่แก้แล้ว → เปิดใหม่
    await h.api("POST", `/support/tickets/${ticketId}/messages`, reader.token, { body: "ยังไม่เข้าค่ะ" });
    expect((await h.api("GET", `/support/tickets/${ticketId}`, reader.token)).json.status).toBe("open");
    expect((await h.api("PATCH", `/support/tickets/${ticketId}/status`, reader.token, { status: "closed" })).status).toBe(200);
    expect((await h.api("POST", `/support/tickets/${ticketId}/messages`, reader.token, { body: "อีกเรื่อง" })).status).toBe(409);
  });
});

describe("notifications page", () => {
  beforeAll(async () => {
    await prisma.notification.createMany({
      data: [
        ...Array.from({ length: 5 }, (_, i) => ({ user_id: reader2.id, type: "new_chapter" as const, content: `ตอนใหม่ ${i}` })),
        { user_id: reader2.id, type: "system" as const, content: "ประกาศ" },
        { user_id: reader2.id, type: "new_follower" as const, content: "มีคนติดตาม", is_read: true },
      ],
    });
  });

  it("paginates, filters and counts unread", async () => {
    const page1 = await h.api("GET", "/notifications?pageSize=4", reader2.token);
    expect(page1.json).toMatchObject({ total: 7, page: 1, unread_count: 6 });
    expect(page1.json.notifications).toHaveLength(4);
    const page2 = await h.api("GET", "/notifications?pageSize=4&page=2", reader2.token);
    expect(page2.json.notifications).toHaveLength(3);
    const sys = await h.api("GET", "/notifications?type=system", reader2.token);
    expect(sys.json.total).toBe(1);
    const unread = await h.api("GET", "/notifications?unread_only=true", reader2.token);
    expect(unread.json.total).toBe(6);
  });

  it("hides muted types and marks all read", async () => {
    const prefs = await h.api("PUT", "/notifications/preferences", reader2.token, { muted_types: ["new_chapter"] });
    expect(prefs.json.muted_types).toEqual(["new_chapter"]);
    const list = await h.api("GET", "/notifications", reader2.token);
    expect(list.json).toMatchObject({ total: 2, unread_count: 1 });

    const all = await h.api("PATCH", "/notifications/read-all", reader2.token, {});
    expect(all.json.updated).toBe(6);
    expect((await h.api("GET", "/notifications", reader2.token)).json.unread_count).toBe(0);
    await h.api("PUT", "/notifications/preferences", reader2.token, { muted_types: [] });
  });
});
