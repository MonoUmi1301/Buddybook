import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createHarness } from "./helpers";

/**
 * Post-moderation — นิยายเผยแพร่ทันทีที่นักเขียนกด, แอดมินตรวจทีหลังแล้วระงับพร้อมเหตุผล (แจ้งในเว็บ + อีเมล),
 * นักเขียนยื่นอุทธรณ์ → แอดมินยืนยันการระงับ หรือคืนสถานะ
 */
const h = createHarness("mod");
let author: { id: string; token: string };
let other: { id: string; token: string };
let reader: { id: string; token: string };
let admin: { id: string; token: string };
let novelId: string;

const REASON = "มีฉากความรุนแรงโจ่งแจ้งโดยไม่ได้ตั้งเรต 18+ ตามแนวทางข้อ 3.2";

beforeAll(async () => {
  author = await h.createUser("author");
  other = await h.createUser("other");
  reader = await h.createUser("reader");
  admin = await h.createUser("admin", { role: "admin" });
  await h.start();
});

afterAll(async () => {
  await prisma.contentReport.deleteMany({ where: { reporter_id: { in: h.userIds } } });
  await h.stop();
  await prisma.$disconnect();
});

const queue = async (tab: string) => {
  const res = await h.api("GET", `/admin/novels/moderation?tab=${tab}`, admin.token);
  expect(res.status).toBe(200);
  return res.json.novels.map((n: { novel_id: string }) => n.novel_id) as string[];
};

describe("publishing goes live immediately", () => {
  it("shows a newly published novel to readers without admin approval", async () => {
    const created = await h.api("POST", "/novels", author.token, { title: `mod ${h.tag}`, legal_status: "original", tag_ids: [] });
    expect(created.status).toBe(201);
    novelId = created.json.novel_id;

    // ยังเป็นส่วนตัว — คนอื่นไม่เห็น
    expect((await h.api("GET", `/novels/${novelId}`)).status).toBe(404);

    const published = await h.api("PATCH", `/novels/${novelId}`, author.token, { visibility: "published" });
    expect(published.status).toBe(200);
    expect(published.json.visibility).toBe("published");
    expect((await h.api("GET", `/novels/${novelId}`)).status).toBe(200);
  });

  it("no longer accepts the old pending_review state", async () => {
    const res = await h.api("PATCH", `/novels/${novelId}`, author.token, { visibility: "pending_review" });
    expect(res.status).toBe(400);
    expect((await h.api("PATCH", `/novels/${novelId}`, author.token, { visibility: "suspended" })).status).toBe(400);
  });

  it("lists live novels in the admin audit queue and drops them once reviewed", async () => {
    expect((await h.api("GET", "/admin/novels/moderation", reader.token)).status).toBe(403);
    expect(await queue("unreviewed")).toContain(novelId);

    expect((await h.api("PATCH", `/admin/novels/${novelId}/reviewed`, admin.token)).status).toBe(200);
    expect(await queue("unreviewed")).not.toContain(novelId);

    // แก้ไขหลังตรวจแล้ว → กลับเข้าคิว
    await new Promise((r) => setTimeout(r, 5));
    await h.api("PATCH", `/novels/${novelId}`, author.token, { synopsis: "แก้เรื่องย่อหลังตรวจ" });
    expect(await queue("unreviewed")).toContain(novelId);
  });
});

describe("suspension", () => {
  it("requires a reason", async () => {
    expect((await h.api("PATCH", `/admin/novels/${novelId}/suspend`, admin.token, {})).status).toBe(400);
    expect((await h.api("PATCH", `/admin/novels/${novelId}/suspend`, admin.token, { reason: "สั้น" })).status).toBe(400);
    expect((await h.api("PATCH", `/admin/novels/${novelId}/suspend`, reader.token, { reason: REASON })).status).toBe(403);
  });

  it("hides the novel and notifies the author with title, reason and an appeal link", async () => {
    const res = await h.api("PATCH", `/admin/novels/${novelId}/suspend`, admin.token, { reason: REASON });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ visibility: "suspended", moderation_case: { status: "suspended", reason: REASON } });
    expect(res.json.notified.web).toBe(true);
    // ผู้ใช้ทดสอบใช้อีเมล *.buddybook.local — ไม่ส่งอีเมลจริง
    expect(res.json.notified.email).toBe(false);

    expect((await h.api("GET", `/novels/${novelId}`)).status).toBe(404);
    expect((await h.api("GET", `/novels/${novelId}`, reader.token)).status).toBe(404);
    const search = await h.api("GET", `/novels/search?q=${encodeURIComponent(`mod ${h.tag}`)}`);
    expect(search.json.novels.map((n: { novel_id: string }) => n.novel_id)).not.toContain(novelId);

    const notes = await prisma.notification.findMany({ where: { user_id: author.id, type: "moderation" } });
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toContain(`mod ${h.tag}`);
    expect(notes[0].content).toContain(REASON);
    expect(notes[0].content).toContain("อุทธรณ์");
    expect(notes[0].link_url).toBe(`/write/${novelId}?appeal=1`);

    expect(await queue("suspended")).toContain(novelId);
    expect(await queue("unreviewed")).not.toContain(novelId);
  });

  it("refuses a second suspension of the same novel", async () => {
    expect((await h.api("PATCH", `/admin/novels/${novelId}/suspend`, admin.token, { reason: REASON })).status).toBe(409);
    expect(await prisma.novelModerationCase.count({ where: { novel_id: novelId } })).toBe(1);
  });

  it("shows the owner the reason and blocks re-publishing, but still allows editing", async () => {
    const own = await h.api("GET", `/novels/${novelId}`, author.token);
    expect(own.status).toBe(200);
    expect(own.json.visibility).toBe("suspended");
    expect(own.json.moderation_case).toMatchObject({ status: "suspended", reason: REASON });

    const mine = await h.api("GET", "/novels/search?mine=true", author.token);
    const listed = mine.json.novels.find((n: { novel_id: string }) => n.novel_id === novelId);
    expect(listed.moderation_case.reason).toBe(REASON);

    expect((await h.api("PATCH", `/novels/${novelId}`, author.token, { visibility: "published" })).status).toBe(409);
    expect((await h.api("PATCH", `/novels/${novelId}`, author.token, { visibility: "private" })).status).toBe(409);
    expect((await h.api("PATCH", `/novels/${novelId}`, author.token, { synopsis: "ตัดฉากรุนแรงออกแล้ว" })).status).toBe(200);
  });

  it("keeps moderation notifications even if the author tries to mute them", async () => {
    const res = await h.api("PUT", "/notifications/preferences", author.token, { muted_types: ["moderation", "system"] });
    expect(res.status).toBe(200);
    expect(res.json.muted_types).toEqual(["system"]);
  });
});

describe("appeals", () => {
  it("validates the appeal", async () => {
    const message = "ตัดฉากที่มีปัญหาออกแล้ว และตั้งเรต 18+ เรียบร้อย รบกวนตรวจซ้ำครับ";
    expect((await h.api("POST", `/novels/${novelId}/appeal`, author.token, { message: "สั้นไป" })).status).toBe(400);
    expect((await h.api("POST", `/novels/${novelId}/appeal`, other.token, { message })).status).toBe(403);
  });

  it("sends the novel back to the admin queue as appeal pending", async () => {
    const message = "ตัดฉากที่มีปัญหาออกแล้ว และตั้งเรต 18+ เรียบร้อย รบกวนตรวจซ้ำครับ";
    const res = await h.api("POST", `/novels/${novelId}/appeal`, author.token, { message });
    expect(res.status).toBe(201);
    expect(res.json.moderation_case).toMatchObject({ status: "appeal_pending", appeal_message: message, appeal_count: 1 });
    expect((await h.api("POST", `/novels/${novelId}/appeal`, author.token, { message })).status).toBe(409);

    const list = await h.api("GET", "/admin/novels/moderation?tab=appeals", admin.token);
    const item = list.json.novels.find((n: { novel_id: string }) => n.novel_id === novelId);
    expect(item.moderation_case).toMatchObject({ status: "appeal_pending", appeal_message: message, reason: REASON });
    expect(list.json.counts.appeals).toBeGreaterThanOrEqual(1);
  });

  it("can uphold the suspension (with an explanation) and the author can appeal again", async () => {
    const path = `/admin/novels/${novelId}/moderation`;
    expect((await h.api("PATCH", path, admin.token, { decision: "uphold" })).status).toBe(400);
    const upheld = await h.api("PATCH", path, admin.token, { decision: "uphold", note: "ยังเหลือฉากในตอนที่ 3" });
    expect(upheld.status).toBe(200);
    expect(upheld.json).toMatchObject({ visibility: "suspended", moderation_case: { status: "upheld" } });
    expect((await h.api("GET", `/novels/${novelId}`)).status).toBe(404);
    expect(
      await prisma.notification.count({ where: { user_id: author.id, type: "moderation", content: { contains: "ตอนที่ 3" } } })
    ).toBe(1);

    const again = await h.api("POST", `/novels/${novelId}/appeal`, author.token, {
      message: "แก้ตอนที่ 3 แล้วเช่นกัน ตรวจได้เลยครับ ขอบคุณมาก",
    });
    expect(again.status).toBe(201);
    expect(again.json.moderation_case).toMatchObject({ status: "appeal_pending", appeal_count: 2, resolution_note: null });
  });

  it("reinstates the novel to its previous visibility", async () => {
    const res = await h.api("PATCH", `/admin/novels/${novelId}/moderation`, admin.token, { decision: "reinstate" });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ visibility: "published", moderation_case: { status: "reinstated" } });
    expect((await h.api("GET", `/novels/${novelId}`)).status).toBe(200);
    expect(await queue("appeals")).not.toContain(novelId);
    expect(await queue("suspended")).not.toContain(novelId);

    // ไม่มีเคสเปิดอยู่แล้ว — ตัดสินซ้ำ/อุทธรณ์ไม่ได้
    expect((await h.api("PATCH", `/admin/novels/${novelId}/moderation`, admin.token, { decision: "reinstate" })).status).toBe(409);
    expect(
      (await h.api("POST", `/novels/${novelId}/appeal`, author.token, { message: "อุทธรณ์ซ้ำหลังได้รับการคืนสถานะแล้ว" })).status
    ).toBe(409);
    const own = await h.api("GET", `/novels/${novelId}`, author.token);
    expect(own.json.moderation_case).toBeNull();
  });
});

describe("reported novels", () => {
  it("suspends through the content-report flow with a reason the author can see", async () => {
    const filed = await h.api("POST", "/reports", reader.token, { target_type: "novel", target_id: novelId, reason: "copyright" });
    expect(filed.status).toBe(201);
    expect(await queue("reported")).toContain(novelId);

    const list = await h.api("GET", "/admin/content-reports", admin.token);
    const report = list.json.reports.find((r: { target_id: string }) => r.target_id === novelId);
    const res = await h.api("PATCH", `/admin/content-reports/${report.report_id}`, admin.token, { action: "action" });
    expect(res.json).toMatchObject({ status: "actioned", resolved_count: 1 });

    const novel = await prisma.novel.findUniqueOrThrow({ where: { novel_id: novelId }, select: { visibility: true } });
    expect(novel.visibility).toBe("suspended");
    const open = await prisma.novelModerationCase.findFirstOrThrow({ where: { novel_id: novelId, status: "suspended" } });
    expect(open.reason).toContain("ละเมิดลิขสิทธิ์");
    expect(await queue("reported")).not.toContain(novelId);
  });

  it("closes open reports when an admin suspends from the audit queue", async () => {
    await h.api("PATCH", `/admin/novels/${novelId}/moderation`, admin.token, { decision: "reinstate" });
    expect((await h.api("POST", "/reports", other.token, { target_type: "novel", target_id: novelId, reason: "spam" })).status).toBe(201);

    expect((await h.api("PATCH", `/admin/novels/${novelId}/suspend`, admin.token, { reason: REASON })).status).toBe(200);
    expect(await prisma.contentReport.count({ where: { target_id: novelId, status: "open" } })).toBe(0);
    expect(
      await prisma.notification.count({ where: { user_id: other.id, type: "system", content: { contains: "รายงาน" } } })
    ).toBe(1);
  });
});
