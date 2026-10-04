import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { purgeExpiredNovels } from "@/modules/novels/novels.service";
import { createHarness } from "./helpers";

/** Integration — gap 2.4 (ลบนิยายแบบ soft delete 30 วัน) และ gap 2.5 (autosave ตรวจการแก้ไขชนกัน) */
const h = createHarness("wr");
let author: { id: string; token: string };
let other: { id: string; token: string };

async function makeNovel(title: string) {
  const n = await prisma.novel.create({
    data: { author_id: author.id, title: `${title} ${h.tag}`, visibility: "published" },
    select: { novel_id: true },
  });
  return n.novel_id;
}

beforeAll(async () => {
  author = await h.createUser("author");
  other = await h.createUser("other");
  await h.start();
});

afterAll(async () => {
  await h.stop();
  await prisma.$disconnect();
});

describe("novel soft delete", () => {
  it("moves a novel to the trash, hides it, and restores its previous visibility", async () => {
    const id = await makeNovel("ลบแล้วกู้");
    const del = await h.api("DELETE", `/novels/${id}`, author.token);
    expect(del.status).toBe(200);
    const autoDelete = new Date(del.json.auto_delete_at).getTime() - new Date(del.json.deleted_at).getTime();
    expect(Math.round(autoDelete / 86_400_000)).toBe(30);

    // ซ่อนจากสาธารณะ + จาก dashboard ของเจ้าของ
    expect((await h.api("GET", `/novels/${id}`)).status).toBe(404);
    expect((await h.api("GET", `/novels/${id}`, author.token)).status).toBe(404);
    const mine = await h.api("GET", "/novels/search?mine=true", author.token);
    expect(mine.json.novels.map((n: { novel_id: string }) => n.novel_id)).not.toContain(id);

    const trash = await h.api("GET", "/novels/trash", author.token);
    expect(trash.status).toBe(200);
    expect(trash.json.novels.map((n: { novel_id: string }) => n.novel_id)).toContain(id);

    // แก้ไขระหว่างอยู่ในถังขยะไม่ได้
    expect((await h.api("PATCH", `/novels/${id}`, author.token, { title: "แอบแก้" })).status).toBe(409);

    const restored = await h.api("POST", `/novels/${id}/restore`, author.token);
    expect(restored.status).toBe(200);
    expect(restored.json.visibility).toBe("published");
    expect((await h.api("GET", `/novels/${id}`)).status).toBe(200);
  });

  it("only lets the owner act on the trash", async () => {
    const id = await makeNovel("ของคนอื่น");
    expect((await h.api("DELETE", `/novels/${id}`, other.token)).status).toBe(403);
    await h.api("DELETE", `/novels/${id}`, author.token);
    expect((await h.api("POST", `/novels/${id}/restore`, other.token)).status).toBe(403);
    expect((await h.api("DELETE", `/novels/${id}/permanent`, other.token)).status).toBe(403);
    const otherTrash = await h.api("GET", "/novels/trash", other.token);
    expect(otherTrash.json.novels).toEqual([]);
  });

  it("requires the trash before a permanent delete, then removes everything", async () => {
    const id = await makeNovel("ลบถาวร");
    await prisma.chapter.create({ data: { novel_id: id, chapter_number: 1, title: "c", content: "<p>x</p>" } });
    expect((await h.api("DELETE", `/novels/${id}/permanent`, author.token)).status).toBe(409);
    await h.api("DELETE", `/novels/${id}`, author.token);
    expect((await h.api("DELETE", `/novels/${id}/permanent`, author.token)).status).toBe(204);
    expect(await prisma.novel.findUnique({ where: { novel_id: id } })).toBeNull();
    expect(await prisma.chapter.count({ where: { novel_id: id } })).toBe(0);
  });

  it("refuses to delete a novel whose chapters were bought", async () => {
    const id = await makeNovel("ขายแล้ว");
    const ch = await prisma.chapter.create({
      data: { novel_id: id, chapter_number: 1, title: "paid", content: "<p>x</p>", status: "published", price_coins: 5 },
      select: { chapter_id: true },
    });
    await prisma.chapterPurchase.create({ data: { user_id: other.id, chapter_id: ch.chapter_id, price_coins: 5, fee_coins: 0 } });
    expect((await h.api("DELETE", `/novels/${id}`, author.token)).status).toBe(409);
    await prisma.chapterPurchase.deleteMany({ where: { chapter_id: ch.chapter_id } });
  });

  it("purges novels that have been in the trash for 30 days", async () => {
    const oldId = await makeNovel("เก่า");
    const recentId = await makeNovel("ใหม่");
    await prisma.novel.update({ where: { novel_id: oldId }, data: { deleted_at: new Date(Date.now() - 31 * 86_400_000), visibility: "private" } });
    await prisma.novel.update({ where: { novel_id: recentId }, data: { deleted_at: new Date(Date.now() - 2 * 86_400_000), visibility: "private" } });
    await purgeExpiredNovels();
    expect(await prisma.novel.findUnique({ where: { novel_id: oldId } })).toBeNull();
    expect(await prisma.novel.findUnique({ where: { novel_id: recentId } })).not.toBeNull();
  });
});

describe("autosave edit conflict", () => {
  it("rejects an autosave based on a stale copy and accepts the fresh one", async () => {
    const id = await makeNovel("autosave");
    const ch = await prisma.chapter.create({
      data: { novel_id: id, chapter_number: 1, title: "ตอนแรก", content: "<p>เดิม</p>", updated_at: new Date("2026-01-01T00:00:00Z") },
      select: { chapter_id: true },
    });

    // แท็บ A บันทึกสำเร็จ ได้ updated_at ใหม่
    const a = await h.api("PATCH", `/chapters/${ch.chapter_id}/autosave`, author.token, {
      content_snapshot: "<p>จากแท็บ A</p>",
      base_updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(a.status).toBe(200);
    expect(a.json.chapter_updated_at).toBeTruthy();

    // แท็บ B ยังถือฉบับเก่าอยู่ → 409 ไม่ทับงานของแท็บ A
    const b = await h.api("PATCH", `/chapters/${ch.chapter_id}/autosave`, author.token, {
      content_snapshot: "<p>จากแท็บ B</p>",
      base_updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(b.status).toBe(409);
    expect(b.json.details.code).toBe("EDIT_CONFLICT");
    expect((await prisma.chapter.findUniqueOrThrow({ where: { chapter_id: ch.chapter_id } })).content).toBe("<p>จากแท็บ A</p>");

    // ส่งต่อจากฉบับล่าสุด → ผ่าน; ไม่ส่ง base (client เก่า) → ผ่านเหมือนเดิม
    const c = await h.api("PATCH", `/chapters/${ch.chapter_id}/autosave`, author.token, {
      content_snapshot: "<p>ต่อจาก A</p>",
      base_updated_at: a.json.chapter_updated_at,
    });
    expect(c.status).toBe(200);
    const legacy = await h.api("PATCH", `/chapters/${ch.chapter_id}/autosave`, author.token, { content_snapshot: "<p>legacy</p>" });
    expect(legacy.status).toBe(200);
    expect(await prisma.chapterVersion.count({ where: { chapter_id: ch.chapter_id } })).toBe(3);
  });
});

describe("concurrent autosaves", () => {
  it("never drops a save when two arrive at once (race found by the k6 load test)", async () => {
    const id = await makeNovel("พร้อมกัน");
    const ch = await prisma.chapter.create({
      data: { novel_id: id, chapter_number: 1, title: "c", content: "<p>x</p>" },
      select: { chapter_id: true },
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        h.api("PATCH", `/chapters/${ch.chapter_id}/autosave`, author.token, { content_snapshot: `<p>${i}</p>` })
      )
    );
    expect(results.map((r) => r.status)).toEqual(Array(8).fill(200));
    const versions = await prisma.chapterVersion.findMany({ where: { chapter_id: ch.chapter_id }, select: { version_number: true } });
    expect(versions.map((v) => v.version_number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
