import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { signRefreshToken } from "@/lib/jwt";
import { createHarness } from "./helpers";

/** นิยายของบัญชีที่ถูกลบต้องหายจากเว็บ (ผลทดสอบ: หน้า "kido โดย ผู้ใช้ที่ถูกลบ_468242e3") */
const h = createHarness("delacct");

async function novel(author_id: string, title: string, visibility: "published" | "pending_review" = "published") {
  const n = await prisma.novel.create({
    data: { author_id, title: `${title} ${h.tag}`, visibility },
    select: { novel_id: true },
  });
  return n.novel_id;
}

beforeAll(async () => {
  await h.start();
});

afterAll(async () => {
  await h.stop();
});

describe("deleting an account", () => {
  it("moves the author's novels to the trash and hides them", async () => {
    const author = await h.createUser("author");
    const reader = await h.createUser("reader");
    // บัญชี OAuth ล้วนลบได้โดยไม่ต้องกรอกรหัสผ่าน
    await prisma.user.update({ where: { user_id: author.id }, data: { password_hash: null, oauth_provider: "google", oauth_id: `g_${h.tag}` } });
    const published = await novel(author.id, "published");
    const draft = await novel(author.id, "draft", "pending_review");

    expect((await h.api("GET", `/novels/${published}`, reader.token)).status).toBe(200);

    const refresh_token = signRefreshToken({ user_id: author.id, role: "user" });
    expect((await h.api("POST", "/auth/refresh", undefined, { refresh_token })).status).toBe(200);

    const res = await h.api("DELETE", "/users/me", author.token, {});
    expect(res.status).toBe(204);
    const deleted = await prisma.user.findUnique({ where: { user_id: author.id }, select: { deleted_at: true, oauth_provider: true } });
    expect(deleted?.deleted_at).not.toBeNull();
    expect(deleted?.oauth_provider).toBeNull();
    // refresh token ที่ออกก่อนลบบัญชีต้องใช้ต่ออายุไม่ได้อีก
    expect((await h.api("POST", "/auth/refresh", undefined, { refresh_token })).status).toBe(401);

    const rows = await prisma.novel.findMany({
      where: { novel_id: { in: [published, draft] } },
      select: { novel_id: true, visibility: true, visibility_before_delete: true, deleted_at: true },
    });
    for (const r of rows) {
      expect(r.deleted_at).not.toBeNull();
      expect(r.visibility).toBe("private");
    }
    expect(rows.find((r) => r.novel_id === published)?.visibility_before_delete).toBe("published");
    expect(rows.find((r) => r.novel_id === draft)?.visibility_before_delete).toBe("pending_review");

    expect((await h.api("GET", `/novels/${published}`, reader.token)).status).toBe(404);
    const search = await h.api("GET", `/novels/search?q=${encodeURIComponent(`published ${h.tag}`)}`);
    expect(JSON.stringify(search.json)).not.toContain(published);
  });

  it("leaves other authors' novels alone", async () => {
    const leaving = await h.createUser("leaving");
    const staying = await h.createUser("staying");
    await prisma.user.update({ where: { user_id: leaving.id }, data: { password_hash: null, oauth_provider: "google", oauth_id: `g2_${h.tag}` } });
    const keep = await novel(staying.id, "keep");
    await novel(leaving.id, "gone");

    await h.api("DELETE", "/users/me", leaving.token, {});
    const kept = await prisma.novel.findUnique({ where: { novel_id: keep }, select: { deleted_at: true, visibility: true } });
    expect(kept).toEqual({ deleted_at: null, visibility: "published" });
  });
});

describe("migration for accounts deleted before this change", () => {
  it("trashes novels of already-anonymized accounts only", async () => {
    const ghost = await h.createUser("ghost");
    const alive = await h.createUser("alive");
    // บัญชีที่ DELETE /users/me รุ่นเก่า anonymize ไปแล้ว (อีเมลที่ระบบแทนให้) แต่ยังไม่มี deleted_at และนิยายยังเผยแพร่
    await prisma.user.update({
      where: { user_id: ghost.id },
      data: { email: `deleted+${ghost.id}@buddybook.invalid`, deleted_at: null },
    });
    const orphan = await novel(ghost.id, "orphan");
    const ok = await novel(alive.id, "ok");

    const sql = fs.readFileSync(
      path.resolve(__dirname, "../prisma/migrations/20261018090000_deleted_accounts/migration.sql"),
      "utf8"
    );
    // รันทีละคำสั่ง (Prisma ไม่รับหลายคำสั่งในครั้งเดียว) — migration เขียนให้รันซ้ำได้
    const statements = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((st) => st.trim())
      .filter(Boolean);
    for (const st of statements) await prisma.$executeRawUnsafe(st);

    expect((await prisma.user.findUnique({ where: { user_id: ghost.id }, select: { deleted_at: true } }))?.deleted_at).not.toBeNull();
    expect((await prisma.user.findUnique({ where: { user_id: alive.id }, select: { deleted_at: true } }))?.deleted_at).toBeNull();
    const orphanRow = await prisma.novel.findUnique({ where: { novel_id: orphan }, select: { deleted_at: true, visibility: true } });
    expect(orphanRow?.deleted_at).not.toBeNull();
    expect(orphanRow?.visibility).toBe("private");
    const okRow = await prisma.novel.findUnique({ where: { novel_id: ok }, select: { deleted_at: true } });
    expect(okRow?.deleted_at).toBeNull();
  });
});
