import crypto from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "@/app";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/jwt";
import { resetRateLimits } from "@/middleware/rateLimit.middleware";
import { getBalance } from "@/modules/wallet/wallet.service";
import { splitGiftFee } from "@/modules/gifts/gift-fee";

/**
 * Integration — ติดตามนักเขียน, รายงานเนื้อหา, ตอนติดเหรียญ, ถอนรายได้, ระงับบัญชี, rate limit ล็อกอิน
 * ยิง HTTP จริงเข้า app บนพอร์ตสุ่ม ใช้ฐานข้อมูลตาม DATABASE_URL (.env) สร้างผู้ใช้/นิยายทดสอบเองแล้วลบทิ้งตอนจบ
 */

const tag = crypto.randomBytes(4).toString("hex");

let server: Server;
let baseUrl: string;
let readerId: string;
let authorId: string;
let adminId: string;
let readerToken: string;
let authorToken: string;
let adminToken: string;
let novelId: string;

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function topup(user_id: string, coins: number) {
  const balance = await getBalance(user_id);
  await prisma.walletTransaction.create({
    data: { user_id, type: "topup", amount: coins, balance_after: balance + coins, reference_id: crypto.randomUUID() },
  });
}

let chapterCounter = 0;
async function createChapter(price_coins = 0) {
  chapterCounter += 1;
  const res = await api("POST", `/novels/${novelId}/chapters`, authorToken, {
    chapter_number: chapterCounter,
    title: `ตอนทดสอบ ${chapterCounter}`,
    content: "<p>เนื้อหาลับ</p>",
    status: "published",
    price_coins,
  });
  expect(res.status).toBe(201);
  return res.json.chapter_id as string;
}

beforeAll(async () => {
  const users = await Promise.all(
    (["reader", "author", "admin"] as const).map((r) =>
      prisma.user.create({
        data: {
          username: `ft_${r}_${tag}`,
          email: `ft_${r}_${tag}@test.buddybook.local`,
          password_hash: "not-a-real-hash",
          role: r === "admin" ? "admin" : "user",
        },
        select: { user_id: true },
      })
    )
  );
  [readerId, authorId, adminId] = users.map((u) => u.user_id);
  readerToken = signAccessToken({ user_id: readerId, role: "user" });
  authorToken = signAccessToken({ user_id: authorId, role: "user" });
  adminToken = signAccessToken({ user_id: adminId, role: "admin" });

  const novel = await prisma.novel.create({
    data: { author_id: authorId, title: `นิยายทดสอบ ${tag}`, visibility: "published" },
    select: { novel_id: true },
  });
  novelId = novel.novel_id;

  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  const ids = [readerId, authorId, adminId].filter(Boolean);
  await prisma.contentReport.deleteMany({ where: { reporter_id: { in: ids } } });
  await prisma.withdrawalRequest.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.comment.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.trashBin.deleteMany({ where: { novel_id: novelId } });
  await prisma.novel.deleteMany({ where: { novel_id: novelId } });
  await prisma.notification.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.walletTransaction.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.user.deleteMany({ where: { user_id: { in: ids } } });
  await new Promise((resolve) => server?.close(resolve));
  await prisma.$disconnect();
});

beforeEach(() => resetRateLimits());

describe("author follows", () => {
  it("follows, notifies the author, and reports status", async () => {
    const res = await api("POST", `/users/${authorId}/follow`, readerToken);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ following: true, follower_count: 1 });

    // follow ซ้ำ = idempotent ไม่แจ้งเตือนซ้ำ
    await api("POST", `/users/${authorId}/follow`, readerToken);
    expect(await prisma.notification.count({ where: { user_id: authorId, type: "new_follower" } })).toBe(1);

    const status = await api("GET", `/users/${authorId}/follow`, readerToken);
    expect(status.json).toMatchObject({ following: true, follower_count: 1 });
    const anon = await api("GET", `/users/${authorId}/follow`);
    expect(anon.json).toMatchObject({ following: false, follower_count: 1 });

    const list = await api("GET", "/users/me/following", readerToken);
    expect(list.json.following.map((f: { user_id: string }) => f.user_id)).toEqual([authorId]);
  });

  it("rejects following yourself", async () => {
    const res = await api("POST", `/users/${authorId}/follow`, authorToken);
    expect(res.status).toBe(422);
  });

  it("notifies followers when the author publishes a chapter", async () => {
    const before = await prisma.notification.count({ where: { user_id: readerId, type: "new_chapter" } });
    await createChapter();
    expect(await prisma.notification.count({ where: { user_id: readerId, type: "new_chapter" } })).toBe(before + 1);
  });

  it("unfollows", async () => {
    const res = await api("DELETE", `/users/${authorId}/follow`, readerToken);
    expect(res.json).toMatchObject({ following: false, follower_count: 0 });
  });
});

describe("paid chapters", () => {
  let chapterId: string;
  const PRICE = 30;

  beforeAll(async () => {
    chapterId = await createChapter(PRICE);
  });

  it("hides the content of an unpurchased chapter", async () => {
    const res = await api("GET", `/chapters/${chapterId}`, readerToken);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ locked: true, content: null, price_coins: PRICE });

    const anon = await api("GET", `/chapters/${chapterId}`);
    expect(anon.json.content).toBeNull();

    const owner = await api("GET", `/chapters/${chapterId}`, authorToken);
    expect(owner.json).toMatchObject({ locked: false, content: "<p>เนื้อหาลับ</p>" });

    const list = await api("GET", `/novels/${novelId}/chapters`, readerToken);
    const row = list.json.chapters.find((c: { chapter_id: string }) => c.chapter_id === chapterId);
    expect(row).toMatchObject({ price_coins: PRICE, is_unlocked: false });
  });

  it("rejects a purchase with insufficient coins without charging", async () => {
    const res = await api("POST", `/chapters/${chapterId}/purchase`, readerToken);
    expect(res.status).toBe(422);
    expect(await prisma.chapterPurchase.count({ where: { chapter_id: chapterId } })).toBe(0);
  });

  it("charges once for concurrent purchases and credits the author the net amount", async () => {
    await topup(readerId, 100);
    const readerBefore = await getBalance(readerId);
    const authorBefore = await getBalance(authorId);

    const [a, b] = await Promise.all([
      api("POST", `/chapters/${chapterId}/purchase`, readerToken),
      api("POST", `/chapters/${chapterId}/purchase`, readerToken),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect([a.json.already_owned, b.json.already_owned].sort()).toEqual([false, true]);

    const { net } = splitGiftFee(PRICE, env.CHAPTER_PLATFORM_FEE_PERCENT);
    expect(await getBalance(readerId)).toBe(readerBefore - PRICE);
    expect(await getBalance(authorId)).toBe(authorBefore + net);

    const res = await api("GET", `/chapters/${chapterId}`, readerToken);
    expect(res.json).toMatchObject({ locked: false, content: "<p>เนื้อหาลับ</p>" });
  });

  it("keeps purchases when the chapter is trashed and restored", async () => {
    const del = await api("DELETE", `/chapters/${chapterId}`, authorToken);
    expect(del.status).toBe(200);
    expect(await prisma.chapterPurchase.count({ where: { chapter_id: chapterId } })).toBe(0);

    const trash = await api("GET", `/novels/${novelId}/trash-bin`, authorToken);
    const item = trash.json.items.find((i: { content_snapshot: { chapter_id: string } }) => i.content_snapshot.chapter_id === chapterId);
    expect(item.content_snapshot.purchases).toBeUndefined();

    const restore = await api("POST", `/trash-bin/${del.json.trash_id}/restore`, authorToken);
    expect(restore.status).toBe(200);
    const res = await api("GET", `/chapters/${chapterId}`, readerToken);
    expect(res.json).toMatchObject({ locked: false, price_coins: PRICE });
  });

  it("refuses to sell a free chapter", async () => {
    const free = await createChapter(0);
    expect((await api("POST", `/chapters/${free}/purchase`, readerToken)).status).toBe(422);
  });
});

describe("withdrawals", () => {
  const originalMin = env.WITHDRAWAL_MIN_COINS;

  beforeAll(async () => {
    env.WITHDRAWAL_MIN_COINS = 5;
    // เงินที่เติมเองถอนไม่ได้ — นักเขียนมี coin เติมเอง 1000 + รายได้จากขายตอนจากเทสต์ก่อนหน้า
    await topup(authorId, 1000);
  });
  afterAll(() => {
    env.WITHDRAWAL_MIN_COINS = originalMin;
  });

  const body = (amount_coins: number) => ({
    amount_coins,
    payout_method: "promptpay",
    account_name: "นักเขียน ทดสอบ",
    account_number: "081-234-5678",
  });

  it("only allows withdrawing earned coins", async () => {
    const summary = await api("GET", "/wallet/withdrawals", authorToken);
    const earned = summary.json.total_earned;
    expect(earned).toBeGreaterThan(0);
    expect(summary.json.withdrawable_coins).toBe(earned);
    expect(summary.json.balance).toBeGreaterThan(earned);

    const tooMuch = await api("POST", "/wallet/withdrawals", authorToken, body(earned + 1));
    expect(tooMuch.status).toBe(422);
  });

  it("holds coins on request, blocks a second pending request, and refunds on reject", async () => {
    const before = await getBalance(authorId);
    const created = await api("POST", "/wallet/withdrawals", authorToken, body(10));
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ status: "pending", account_number: "0812345678" });
    expect(await getBalance(authorId)).toBe(before - 10);

    expect((await api("POST", "/wallet/withdrawals", authorToken, body(5))).status).toBe(409);

    expect((await api("GET", "/admin/withdrawals", authorToken)).status).toBe(403);
    const pending = await api("GET", "/admin/withdrawals", adminToken);
    expect(pending.json.withdrawals.map((w: { withdrawal_id: string }) => w.withdrawal_id)).toContain(created.json.withdrawal_id);

    const [r1, r2] = await Promise.all([
      api("PATCH", `/admin/withdrawals/${created.json.withdrawal_id}`, adminToken, { action: "rejected", note: "เลขบัญชีผิด" }),
      api("PATCH", `/admin/withdrawals/${created.json.withdrawal_id}`, adminToken, { action: "rejected" }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    expect(await getBalance(authorId)).toBe(before);
  });

  it("marks a request as paid without refunding", async () => {
    const before = await getBalance(authorId);
    const created = await api("POST", "/wallet/withdrawals", authorToken, body(5));
    const paid = await api("PATCH", `/admin/withdrawals/${created.json.withdrawal_id}`, adminToken, { action: "paid" });
    expect(paid.json.status).toBe("paid");
    expect(await getBalance(authorId)).toBe(before - 5);
  });
});

describe("content reports", () => {
  let commentId: string;

  beforeAll(async () => {
    const chapterId = await createChapter();
    const comment = await api("POST", `/chapters/${chapterId}/comments`, authorToken, { content: "สแปม สแปม" });
    expect(comment.status).toBe(201);
    commentId = comment.json.comment_id;
  });

  it("files a report once and refuses reports on your own content", async () => {
    const report = { target_type: "comment", target_id: commentId, reason: "spam", details: "โฆษณา" };
    expect((await api("POST", "/reports", readerToken, report)).status).toBe(201);
    expect((await api("POST", "/reports", readerToken, report)).status).toBe(409);
    expect((await api("POST", "/reports", authorToken, report)).status).toBe(422);
    expect(
      (await api("POST", "/reports", readerToken, { ...report, target_id: crypto.randomUUID() })).status
    ).toBe(404);
  });

  it("lets an admin action a report, removing the comment and notifying the reporter", async () => {
    expect((await api("GET", "/admin/content-reports", readerToken)).status).toBe(403);
    const list = await api("GET", "/admin/content-reports", adminToken);
    const report = list.json.reports.find((r: { target_id: string }) => r.target_id === commentId);
    expect(report.target.preview).toBe("สแปม สแปม");

    const res = await api("PATCH", `/admin/content-reports/${report.report_id}`, adminToken, { action: "action" });
    expect(res.json).toMatchObject({ status: "actioned", resolved_count: 1 });
    expect(await prisma.comment.count({ where: { comment_id: commentId } })).toBe(0);
    expect(
      await prisma.notification.count({ where: { user_id: readerId, type: "system", content: { contains: "รายงาน" } } })
    ).toBe(1);

    const again = await api("PATCH", `/admin/content-reports/${report.report_id}`, adminToken, { action: "dismiss" });
    expect(again.status).toBe(409);
  });
});

describe("account suspension", () => {
  it("blocks an already-issued access token as soon as the user is suspended", async () => {
    expect((await api("GET", "/users/me", readerToken)).status).toBe(200);

    expect((await api("PATCH", `/admin/users/${readerId}/suspend`, adminToken, {})).status).toBe(200);
    const blocked = await api("GET", "/users/me", readerToken);
    expect(blocked.status).toBe(403);

    const unsuspended = await api("PATCH", `/admin/users/${readerId}/unsuspend`, adminToken, {});
    expect(unsuspended.json).toEqual({ user_id: readerId, suspended: false });
    expect((await api("GET", "/users/me", readerToken)).status).toBe(200);
  });
});

describe("auth rate limiting", () => {
  it("limits login attempts per target email without affecting other emails", async () => {
    const email = `nobody_${tag}@test.buddybook.local`;
    const attempts = [];
    for (let i = 0; i < env.AUTH_RATE_LIMIT_PER_15MIN; i++) {
      attempts.push((await api("POST", "/auth/login", undefined, { email, password: "wrong-password" })).status);
    }
    expect(attempts.every((s) => s === 401)).toBe(true);

    // ตัวพิมพ์ใหญ่/ช่องว่างนับเป็นอีเมลเดียวกัน
    const limited = await api("POST", "/auth/login", undefined, { email: ` ${email.toUpperCase()} `, password: "x" });
    expect(limited.status).toBe(429);

    const other = await api("POST", "/auth/login", undefined, { email: `other_${email}`, password: "x" });
    expect(other.status).toBe(401);
  });
});
