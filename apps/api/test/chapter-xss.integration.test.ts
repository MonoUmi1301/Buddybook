import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetRateLimits } from "@/middleware/rateLimit.middleware";
import { getBalance } from "@/modules/wallet/wallet.service";
import { createHarness } from "./helpers";

/**
 * C1 (code audit 2026-10-25) — เนื้อหาตอนถูกเรนเดอร์ด้วย dangerouslySetInnerHTML ในหน้าอ่าน
 * ทุกทางที่เขียน (สร้าง/แก้/autosave/กู้คืนเวอร์ชัน) และทุกทางที่ส่งเนื้อหาออก (อ่าน/ซื้อ) ต้องได้ HTML ที่กรองแล้ว
 */
const h = createHarness("xss");
let author: { id: string; token: string };
let reader: { id: string; token: string };
let novelId: string;
let chapterNumber = 0;

const PAYLOAD = '<p>ok</p><img src=x onerror="fetch(\'/api/v1/gifts/send\')"><script>alert(1)</script>';
const UNSAFE = /onerror|<script|javascript:/i;

async function newChapter(content: string, price_coins = 0) {
  chapterNumber += 1;
  const res = await h.api("POST", `/novels/${novelId}/chapters`, author.token, {
    chapter_number: chapterNumber,
    title: `ตอน ${chapterNumber}`,
    content,
    status: "published",
    price_coins,
  });
  expect(res.status).toBe(201);
  return res.json.chapter_id as string;
}

async function stored(chapter_id: string) {
  return (await prisma.chapter.findUniqueOrThrow({ where: { chapter_id } })).content ?? "";
}

beforeAll(async () => {
  author = await h.createUser("author");
  reader = await h.createUser("reader");
  novelId = (
    await prisma.novel.create({ data: { author_id: author.id, title: `xss ${h.tag}` }, select: { novel_id: true } })
  ).novel_id;
  await h.start();
});

afterAll(async () => {
  await h.stop();
  await prisma.$disconnect();
});

beforeEach(() => resetRateLimits());

describe("chapter content is sanitized", () => {
  it("on create, and the reader gets clean HTML", async () => {
    const id = await newChapter(PAYLOAD);
    expect(await stored(id)).not.toMatch(UNSAFE);
    expect(await stored(id)).toContain("<p>ok</p>");

    const res = await h.api("GET", `/chapters/${id}`, reader.token);
    expect(res.status).toBe(200);
    expect(res.json.content).not.toMatch(UNSAFE);
  });

  it("on update and autosave", async () => {
    const id = await newChapter("<p>เดิม</p>");

    const updated = await h.api("PATCH", `/chapters/${id}`, author.token, { content: PAYLOAD });
    expect(updated.status).toBe(200);
    expect(updated.json.content).not.toMatch(UNSAFE);
    expect(await stored(id)).not.toMatch(UNSAFE);

    const saved = await h.api("PATCH", `/chapters/${id}/autosave`, author.token, { content_snapshot: PAYLOAD });
    expect(saved.status).toBe(200);
    expect(await stored(id)).not.toMatch(UNSAFE);
    const version = await prisma.chapterVersion.findFirstOrThrow({ where: { chapter_id: id }, orderBy: { version_number: "desc" } });
    expect(version.content_snapshot).not.toMatch(UNSAFE);
  });

  it("when restoring a version saved before sanitizing existed", async () => {
    const id = await newChapter("<p>เดิม</p>");
    const legacy = await prisma.chapterVersion.create({
      data: { chapter_id: id, content_snapshot: PAYLOAD, version_number: 1, edited_by: author.id, is_autosave: true },
    });

    const res = await h.api("POST", `/chapters/${id}/versions/${legacy.version_id}/restore`, author.token);
    expect(res.status).toBe(200);
    expect(await stored(id)).not.toMatch(UNSAFE);
  });

  it("when reading or buying a chapter stored before sanitizing existed", async () => {
    const free = await newChapter("<p>x</p>");
    const paid = await newChapter("<p>x</p>", 5);
    await prisma.chapter.updateMany({ where: { chapter_id: { in: [free, paid] } }, data: { content: PAYLOAD } });

    const read = await h.api("GET", `/chapters/${free}`, reader.token);
    expect(read.json.content).toContain("<p>ok</p>");
    expect(read.json.content).not.toMatch(UNSAFE);

    await prisma.walletTransaction.create({
      data: { user_id: reader.id, type: "topup", amount: 10, balance_after: (await getBalance(reader.id)) + 10, reference_id: crypto.randomUUID() },
    });
    const bought = await h.api("POST", `/chapters/${paid}/purchase`, reader.token);
    expect(bought.status).toBe(201);
    expect(bought.json.content).not.toMatch(UNSAFE);
    const again = await h.api("POST", `/chapters/${paid}/purchase`, reader.token);
    expect(again.json.already_owned).toBe(true);
    expect(again.json.content).not.toMatch(UNSAFE);
  });
});
