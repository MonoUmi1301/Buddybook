import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetRateLimits } from "@/middleware/rateLimit.middleware";
import { createHarness } from "./helpers";

/**
 * Proposal 3.5.1 — เส้นทางหลักที่เดิมยังไม่มีเทสต์: ล็อกอิน/refresh, ลบตอนลงถังขยะแล้วกู้คืน, กู้คืนเวอร์ชันเนื้อหา
 * (Version History + Soft Delete คือฟีเจอร์หลักฝั่งนักเขียนตามวัตถุประสงค์ข้อ 3)
 */
const h = createHarness("core");
let author: { id: string; token: string };
let email: string;
let novelId: string;

beforeAll(async () => {
  author = await h.createUser("author");
  email = `core_author_${h.tag}@test.buddybook.local`;
  await prisma.user.update({ where: { user_id: author.id }, data: { password_hash: await bcrypt.hash("Secret123!", 10) } });
  novelId = (
    await prisma.novel.create({ data: { author_id: author.id, title: `core ${h.tag}` }, select: { novel_id: true } })
  ).novel_id;
  await h.start();
});

afterAll(async () => {
  await h.stop();
  await prisma.$disconnect();
});

beforeEach(() => resetRateLimits());

describe("password login", () => {
  it("logs in, refreshes, and rejects a wrong password", async () => {
    const bad = await h.api("POST", "/auth/login", undefined, { email, password: "wrong-password" });
    expect(bad.status).toBe(401);

    const ok = await h.api("POST", "/auth/login", undefined, { email, password: "Secret123!" });
    expect(ok.status).toBe(200);
    expect(ok.json.user.user_id).toBe(author.id);

    const refreshed = await h.api("POST", "/auth/refresh", undefined, { refresh_token: ok.json.refresh_token });
    expect(refreshed.status).toBe(200);
    expect(refreshed.json.access_token).toBeTruthy();

    const me = await h.api("GET", "/notifications", refreshed.json.access_token);
    expect(me.status).toBe(200);
  });
});

describe("chapter trash and version history", () => {
  it("moves a deleted chapter to the trash for 30 days and restores it intact", async () => {
    const created = await h.api("POST", `/novels/${novelId}/chapters`, author.token, {
      chapter_number: 1,
      title: "ตอนที่จะลบ",
      content: "<p>เนื้อหาสำคัญ</p>",
      status: "draft",
    });
    expect(created.status).toBe(201);
    const chapterId = created.json.chapter_id;

    const del = await h.api("DELETE", `/chapters/${chapterId}`, author.token);
    expect(del.status).toBe(200);
    expect(await prisma.chapter.findUnique({ where: { chapter_id: chapterId } })).toBeNull();
    const days = (new Date(del.json.auto_delete_at).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(30);

    const restored = await h.api("POST", `/trash-bin/${del.json.trash_id}/restore`, author.token);
    expect(restored.status).toBe(200);
    const back = await prisma.chapter.findFirstOrThrow({ where: { novel_id: novelId, chapter_number: 1 } });
    expect(back.content).toBe("<p>เนื้อหาสำคัญ</p>");
    expect((await h.api("POST", `/trash-bin/${del.json.trash_id}/restore`, author.token)).status).toBe(409);
  });

  it("restores an earlier autosaved version", async () => {
    const chapter = await prisma.chapter.findFirstOrThrow({ where: { novel_id: novelId, chapter_number: 1 } });
    await h.api("PATCH", `/chapters/${chapter.chapter_id}/autosave`, author.token, { content_snapshot: "<p>ฉบับที่ 1</p>" });
    await h.api("PATCH", `/chapters/${chapter.chapter_id}/autosave`, author.token, { content_snapshot: "<p>ฉบับที่ 2 (พลาดลบย่อหน้า)</p>" });

    const list = await h.api("GET", `/chapters/${chapter.chapter_id}/versions`, author.token);
    expect(list.status).toBe(200);
    const v1 = list.json.versions.find((v: { version_number: number }) => v.version_number === 1);

    const res = await h.api("POST", `/chapters/${chapter.chapter_id}/versions/${v1.version_id}/restore`, author.token);
    expect(res.status).toBe(200);
    expect((await prisma.chapter.findUniqueOrThrow({ where: { chapter_id: chapter.chapter_id } })).content).toBe("<p>ฉบับที่ 1</p>");
  });
});
