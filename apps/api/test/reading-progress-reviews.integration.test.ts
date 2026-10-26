import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetRateLimits } from "@/middleware/rateLimit.middleware";
import { createHarness } from "./helpers";

/**
 * แจ้งเตือนรีวิวใหม่ถึงนักเขียน, ป๊อปอัป "อ่านค้างไว้" (resume_from) และรายการ "อ่านต่อ"
 * ที่ตัดเรื่องที่อ่านถึงตอนล่าสุดแล้วออก (แม้เรื่องยังไม่จบ)
 */
const h = createHarness("rpr");
let author: { id: string; token: string };
let reader: { id: string; token: string };
let novelId: string;
const chapterIds: string[] = [];

beforeAll(async () => {
  author = await h.createUser("author");
  reader = await h.createUser("reader");
  novelId = (
    await prisma.novel.create({
      data: { author_id: author.id, title: `rpr ${h.tag}`, visibility: "published" },
      select: { novel_id: true },
    })
  ).novel_id;
  for (const n of [1, 2, 3, 4]) {
    const c = await prisma.chapter.create({
      data: { novel_id: novelId, chapter_number: n, title: `ตอน ${n}`, content: "<p>x</p>", status: "published", published_at: new Date() },
      select: { chapter_id: true },
    });
    chapterIds.push(c.chapter_id);
  }
  await h.start();
});

afterAll(async () => {
  await h.stop();
  await prisma.$disconnect();
});

beforeEach(() => resetRateLimits());

/** recordReadingProgress เป็น fire-and-forget — รอจนบันทึกตอนที่เปิดลง DB ก่อนเปิดตอนถัดไป */
async function read(index: number) {
  const res = await h.api("GET", `/chapters/${chapterIds[index]}`, reader.token);
  expect(res.status).toBe(200);
  for (let i = 0; i < 50; i++) {
    const p = await prisma.readingProgress.findUnique({ where: { user_id_novel_id: { user_id: reader.id, novel_id: novelId } } });
    if (p?.last_chapter_id === chapterIds[index]) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  return res.json as { resume_from: { chapter_id: string; chapter_number: number } | null };
}

async function continueReadingIds() {
  const res = await h.api("GET", "/library/continue-reading?limit=20", reader.token);
  return (res.json.items as { novel: { novel_id: string } }[]).map((i) => i.novel.novel_id);
}

describe("reviews notify the author", () => {
  it("creates a review notification without naming anonymous reviewers", async () => {
    const res = await h.api("POST", `/novels/${novelId}/reviews`, reader.token, { rating: 4, comment_text: "สนุกมาก", is_anonymous: true });
    expect(res.status).toBe(201);
    const notes = await prisma.notification.findMany({ where: { user_id: author.id, type: "review" } });
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toContain("ผู้อ่านนิรนาม");
    expect(notes[0].content).not.toContain(`rpr_reader_${h.tag}`);
    expect(notes[0].link_url).toBe(`/novels/${novelId}#reviews`);
  });
});

describe("resume prompt and continue reading", () => {
  it("asks to resume only when jumping away from the saved chapter", async () => {
    expect((await read(0)).resume_from).toBeNull(); // อ่านครั้งแรก
    expect((await read(1)).resume_from).toBeNull(); // อ่านตอนถัดไปตามลำดับ
    const jumped = await read(3);
    expect(jumped.resume_from).toMatchObject({ chapter_id: chapterIds[1], chapter_number: 2 });
    expect((await read(3)).resume_from).toBeNull(); // เปิดตอนเดิมซ้ำ
  });

  it("drops a novel from continue reading once the latest chapter is read, and brings it back on a new chapter", async () => {
    await read(2);
    expect(await continueReadingIds()).toContain(novelId);

    await read(3);
    expect(await continueReadingIds()).not.toContain(novelId);

    await prisma.chapter.create({
      data: { novel_id: novelId, chapter_number: 5, title: "ตอน 5", content: "<p>x</p>", status: "published", published_at: new Date() },
    });
    expect(await continueReadingIds()).toContain(novelId);
  });
});
