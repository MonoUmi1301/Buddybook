import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetRateLimits } from "@/middleware/rateLimit.middleware";
import { createHarness } from "./helpers";

/**
 * code audit (2026-10-25) — เครื่องมือนักเขียน (ตัวละคร/สถานที่/ไทม์ไลน์) แก้/ลบได้เฉพาะเจ้าของนิยาย
 * และชั้นหนังสือ/collection ไม่ส่งนิยายที่ถูกซ่อน ถูกลบ หรือเกินเรตอายุของผู้อ่านออกไป (M3)
 */
const h = createHarness("wtl");
let author: { id: string; token: string };
let other: { id: string; token: string };
let novelId: string;

async function makeNovel(data: Record<string, unknown> = {}) {
  return (
    await prisma.novel.create({ data: { author_id: author.id, title: `wtl ${h.tag}`, ...data }, select: { novel_id: true } })
  ).novel_id;
}

beforeAll(async () => {
  author = await h.createUser("author");
  other = await h.createUser("other");
  novelId = await makeNovel();
  await h.start();
});

afterAll(async () => {
  await h.stop();
  await prisma.$disconnect();
});

beforeEach(() => resetRateLimits());

describe("writer tools belong to the novel's author", () => {
  it("characters", async () => {
    const created = await h.api("POST", `/novels/${novelId}/characters`, author.token, { character_name: "ลินดา" });
    expect(created.status).toBe(201);
    const id = created.json.node_id;

    expect((await h.api("POST", `/novels/${novelId}/characters`, other.token, { character_name: "x" })).status).toBe(403);
    expect((await h.api("PATCH", `/characters/${id}`, other.token, { character_name: "แก้" })).status).toBe(403);
    expect((await h.api("DELETE", `/characters/${id}`, other.token)).status).toBe(403);
    expect(await prisma.characterNode.count({ where: { node_id: id } })).toBe(1);
  });

  it("locations", async () => {
    const created = await h.api("POST", `/novels/${novelId}/locations`, author.token, { name: "ปราสาท" });
    expect(created.status).toBe(201);
    const id = created.json.location_id;

    expect((await h.api("POST", `/novels/${novelId}/locations`, other.token, { name: "x" })).status).toBe(403);
    expect((await h.api("PATCH", `/locations/${id}`, other.token, { name: "แก้" })).status).toBe(403);
    expect((await h.api("DELETE", `/locations/${id}`, other.token)).status).toBe(403);
    expect(await prisma.location.count({ where: { location_id: id } })).toBe(1);
  });

  it("timeline events", async () => {
    const created = await h.api("POST", `/novels/${novelId}/timeline-events`, author.token, { title: "พบกัน", event_order: 1 });
    expect(created.status).toBe(201);
    const id = created.json.event_id;

    expect((await h.api("POST", `/novels/${novelId}/timeline-events`, other.token, { title: "x", event_order: 2 })).status).toBe(403);
    expect((await h.api("PATCH", `/timeline-events/${id}`, other.token, { title: "แก้" })).status).toBe(403);
    expect((await h.api("DELETE", `/timeline-events/${id}`, other.token)).status).toBe(403);
    expect(await prisma.timelineEvent.count({ where: { event_id: id } })).toBe(1);
  });
});

describe("novel search ?mine=", () => {
  it("treats mine=false like no flag (query strings are not coerced to true)", async () => {
    const title = `mine-flag ${h.tag}`;
    await makeNovel({ title, visibility: "private" });
    const titles = async (qs: string) =>
      (await h.api("GET", `/novels/search?q=${encodeURIComponent(title)}${qs}`, author.token)).json.novels.map(
        (n: { title: string }) => n.title
      );
    expect(await titles("&mine=true")).toContain(title);
    expect(await titles("&mine=false")).not.toContain(title);
    expect((await h.api("GET", "/novels/search?mine=yes", author.token)).status).toBe(400);
  });
});

describe("library only shows novels the reader may see", () => {
  it("refuses to add hidden or age-restricted novels", async () => {
    const hidden = await makeNovel({ visibility: "private" });
    const mature = await makeNovel({ content_rating: "mature" });
    const deleted = await makeNovel({ deleted_at: new Date() });

    expect((await h.api("POST", "/library", other.token, { novel_id: hidden })).status).toBe(404);
    expect((await h.api("POST", "/library", other.token, { novel_id: deleted })).status).toBe(404);
    const age = await h.api("POST", "/library", other.token, { novel_id: mature });
    expect(age.status).toBe(403);
    expect(age.json.details.code).toBe("AGE_VERIFICATION_REQUIRED");
  });

  it("hides novels that became unavailable after they were added, and shows them again when restored", async () => {
    const id = await makeNovel();
    expect((await h.api("POST", "/library", other.token, { novel_id: id })).status).toBe(201);
    const shelf = await h.api("POST", "/collections", other.token, { name: `ชั้น ${h.tag}` });
    expect(shelf.status).toBe(201);
    expect((await h.api("POST", `/collections/${shelf.json.collection_id}/items`, other.token, { novel_id: id })).status).toBe(201);

    const ids = async () => {
      const lib = await h.api("GET", "/library", other.token);
      const cols = await h.api("GET", "/collections", other.token);
      return {
        library: lib.json.library.map((i: { novel: { novel_id: string } }) => i.novel.novel_id),
        collection: cols.json.collections
          .find((c: { collection_id: string }) => c.collection_id === shelf.json.collection_id)
          .novels.map((n: { novel_id: string }) => n.novel_id),
      };
    };
    expect(await ids()).toEqual({ library: expect.arrayContaining([id]), collection: [id] });

    for (const data of [{ visibility: "suspended" as const }, { content_rating: "mature" as const }, { deleted_at: new Date() }]) {
      await prisma.novel.update({ where: { novel_id: id }, data });
      const now = await ids();
      expect(now.library).not.toContain(id);
      expect(now.collection).not.toContain(id);
      await prisma.novel.update({
        where: { novel_id: id },
        data: { visibility: "published", content_rating: "all_ages", deleted_at: null },
      });
    }
    expect((await ids()).library).toContain(id);
  });
});
