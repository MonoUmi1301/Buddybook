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
 * Integration — ยิง HTTP จริงเข้า app บนพอร์ตสุ่ม ใช้ฐานข้อมูลตาม DATABASE_URL (.env)
 * สร้างผู้ใช้ทดสอบ 2 คน (ผู้ส่ง/นักเขียน) แล้วลบทิ้งทั้งหมดตอนจบ ต้อง seed gift_items ก่อน (npx tsx prisma/seed.ts)
 */

const STARTING_COINS = 2000;
const tag = crypto.randomBytes(4).toString("hex");

let server: Server;
let baseUrl: string;
let senderId: string;
let authorId: string;
let senderToken: string;
let authorToken: string;
let coffee: { gift_id: string; price_coins: number };
/** ผู้ใช้ที่เทสต์สร้างเพิ่มระหว่างทาง — ลบพร้อมกันตอนจบ */
const extraUserIds: string[] = [];

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
  return { status: res.status, text, json: text ? JSON.parse(text) : null };
}

const key = () => `test-${crypto.randomUUID()}`;
const donationCount = () => prisma.donation.count({ where: { from_user_id: senderId } });

beforeAll(async () => {
  const [sender, author] = await Promise.all(
    ["sender", "author"].map((role) =>
      prisma.user.create({
        data: {
          username: `gt_${role}_${tag}`,
          email: `gt_${role}_${tag}@test.buddybook.local`,
          password_hash: "not-a-real-hash",
        },
        select: { user_id: true },
      })
    )
  );
  senderId = sender.user_id;
  authorId = author.user_id;
  senderToken = signAccessToken({ user_id: senderId, role: "user" });
  authorToken = signAccessToken({ user_id: authorId, role: "user" });

  await prisma.walletTransaction.create({
    data: {
      user_id: senderId,
      type: "topup",
      amount: STARTING_COINS,
      balance_after: STARTING_COINS,
      reference_id: crypto.randomUUID(),
    },
  });

  const gift = await prisma.giftItem.findUnique({ where: { slug: "coffee" }, select: { gift_id: true, price_coins: true } });
  if (!gift) throw new Error("gift_items not seeded — run `npx tsx prisma/seed.ts` first");
  coffee = gift;

  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  const ids = [senderId, authorId, ...extraUserIds].filter(Boolean);
  await prisma.notification.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.walletTransaction.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.donation.deleteMany({ where: { OR: [{ from_user_id: { in: ids } }, { to_user_id: { in: ids } }] } });
  await prisma.user.deleteMany({ where: { user_id: { in: ids } } });
  await new Promise((resolve) => server?.close(resolve));
  await prisma.$disconnect();
});

beforeEach(() => resetRateLimits());

describe("POST /gifts/send", () => {
  it("charges exactly once for a double click and a retry with the same idempotency key", async () => {
    const before = await getBalance(senderId);
    const countBefore = await donationCount();
    const body = { author_id: authorId, gift_id: coffee.gift_id, quantity: 3, idempotency_key: key() };

    // ดับเบิลคลิก = สอง request พร้อมกัน แล้วตามด้วย retry อีกครั้ง
    const [a, b] = await Promise.all([api("POST", "/gifts/send", senderToken, body), api("POST", "/gifts/send", senderToken, body)]);
    const retry = await api("POST", "/gifts/send", senderToken, body);

    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(retry.status).toBe(200);
    expect(retry.json.replayed).toBe(true);
    expect(new Set([a.json.donation.donation_id, b.json.donation.donation_id, retry.json.donation.donation_id]).size).toBe(1);

    expect(await donationCount()).toBe(countBefore + 1);
    expect(await getBalance(senderId)).toBe(before - coffee.price_coins * 3);
    const debits = await prisma.walletTransaction.count({
      where: { user_id: senderId, type: "donation_sent", reference_id: a.json.donation.donation_id },
    });
    expect(debits).toBe(1);
  });

  it("does not double-spend when different sends race for the last coins", async () => {
    const balance = await getBalance(senderId);
    // ส่งพร้อมกัน 3 รายการที่แต่ละรายการใช้เกินครึ่งของยอดคงเหลือ — ผ่านได้มากสุด 1 รายการ
    const custom = Math.floor(balance / 2) + 1;
    const results = await Promise.all(
      [1, 2, 3].map(() => api("POST", "/gifts/send", senderToken, { author_id: authorId, custom_coins: custom, idempotency_key: key() }))
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 422)).toHaveLength(2);
    expect(await getBalance(senderId)).toBe(balance - custom);

    // เติมคืนให้เทสต์ถัดไป
    await prisma.walletTransaction.create({
      data: { user_id: senderId, type: "topup", amount: STARTING_COINS, balance_after: balance - custom + STARTING_COINS, reference_id: crypto.randomUUID() },
    });
  });

  it("rejects an insufficient balance without charging", async () => {
    const before = await getBalance(senderId);
    const countBefore = await donationCount();
    const hugBear = await prisma.giftItem.findUniqueOrThrow({ where: { slug: "hug-bear" } });

    const res = await api("POST", "/gifts/send", senderToken, {
      author_id: authorId,
      gift_id: hugBear.gift_id,
      quantity: 99,
      idempotency_key: key(),
    });

    expect(res.status).toBe(422);
    expect(res.json.details.missing).toBe(hugBear.price_coins * 99 - before);
    expect(await getBalance(senderId)).toBe(before);
    expect(await donationCount()).toBe(countBefore);
  });

  it("ignores a price sent by the client and uses the catalog price", async () => {
    const before = await getBalance(senderId);
    const res = await api("POST", "/gifts/send", senderToken, {
      author_id: authorId,
      gift_id: coffee.gift_id,
      quantity: 2,
      idempotency_key: key(),
      price_coins: 1,
      amount: 1,
      unit_price_coins: 1,
      total: 1,
    });

    expect(res.status).toBe(201);
    expect(res.json.donation.amount).toBe(coffee.price_coins * 2);
    expect(res.json.donation.unit_price_coins).toBe(coffee.price_coins);
    expect(await getBalance(senderId)).toBe(before - coffee.price_coins * 2);
  });

  it("credits the author gross minus the configured platform fee", async () => {
    const res = await api("POST", "/gifts/send", senderToken, {
      author_id: authorId,
      gift_id: coffee.gift_id,
      quantity: 7,
      idempotency_key: key(),
    });
    expect(res.status).toBe(201);

    const gross = coffee.price_coins * 7;
    const { fee, net } = splitGiftFee(gross, env.GIFT_PLATFORM_FEE_PERCENT);
    const credit = await prisma.walletTransaction.findFirstOrThrow({
      where: { user_id: authorId, type: "donation_received", reference_id: res.json.donation.donation_id },
    });
    const donation = await prisma.donation.findUniqueOrThrow({ where: { donation_id: res.json.donation.donation_id } });

    expect(credit.amount.toNumber()).toBe(net);
    expect(donation.fee_amount.toNumber()).toBe(fee);
    expect(donation.net_amount.toNumber() + donation.fee_amount.toNumber()).toBe(gross);
  });

  it("rejects a card containing a link without charging", async () => {
    const before = await getBalance(senderId);
    const res = await api("POST", "/gifts/send", senderToken, {
      author_id: authorId,
      gift_id: coffee.gift_id,
      idempotency_key: key(),
      card: { template: "stamp", message: "มาอ่านเรื่องเราที่ mysite.com นะ" },
    });
    expect(res.status).toBe(422);
    expect(res.json.details.reason).toBe("link");
    expect(await getBalance(senderId)).toBe(before);
  });

  it("blocks self-gifting", async () => {
    const res = await api("POST", "/gifts/send", senderToken, { author_id: senderId, gift_id: coffee.gift_id, idempotency_key: key() });
    expect(res.status).toBe(400);
  });

  it("rejects an inactive gift", async () => {
    const hidden = await prisma.giftItem.create({
      data: { slug: `test-inactive-${tag}`, name_th: "ทดสอบ", name_en: "Test", price_coins: 5, tier: "S", image_url: "/donate/gifts/coffee.png", is_active: false },
    });
    try {
      const res = await api("POST", "/gifts/send", senderToken, { author_id: authorId, gift_id: hidden.gift_id, idempotency_key: key() });
      expect(res.status).toBe(422);
    } finally {
      await prisma.giftItem.delete({ where: { gift_id: hidden.gift_id } });
    }
  });

  it("notifies the author in plain text, hiding anonymous senders", async () => {
    await api("POST", "/gifts/send", senderToken, {
      author_id: authorId,
      gift_id: coffee.gift_id,
      quantity: 3,
      idempotency_key: key(),
      card: { message: "สู้ ๆ นะคะ", is_anonymous: true },
    });
    const latest = await prisma.notification.findFirstOrThrow({ where: { user_id: authorId }, orderBy: { created_at: "desc" } });
    expect(latest.content).toBe("นักอ่านนิรนาม ส่งกาแฟ x3 ให้คุณ พร้อมการ์ด");
  });
});

describe("privacy", () => {
  it("never exposes private messages or anonymous senders through the public API", async () => {
    const secret = `ความลับ ${tag}`;
    const publicMsg = `เปิดเผย ${tag}`;
    const anonMsg = `นิรนาม ${tag}`;
    await api("POST", "/gifts/send", senderToken, { author_id: authorId, gift_id: coffee.gift_id, idempotency_key: key(), card: { message: secret, is_public: false } });
    await api("POST", "/gifts/send", senderToken, { author_id: authorId, gift_id: coffee.gift_id, idempotency_key: key(), card: { message: publicMsg, is_public: true, signature_name: "แฟนคลับ" } });
    await api("POST", "/gifts/send", senderToken, {
      author_id: authorId,
      gift_id: coffee.gift_id,
      idempotency_key: key(),
      card: { message: anonMsg, is_public: true, is_anonymous: true, signature_name: "ชื่อจริงที่ไม่อยากให้เห็น" },
    });

    const pub = await api("GET", `/authors/${authorId}/gifts/public`);
    expect(pub.status).toBe(200);
    expect(pub.text).not.toContain(secret);
    expect(pub.text).toContain(publicMsg);
    expect(pub.text).toContain(anonMsg);
    expect(pub.text).not.toContain("ชื่อจริงที่ไม่อยากให้เห็น");

    const anonCard = pub.json.recent_cards.find((c: { message: string }) => c.message === anonMsg);
    expect(anonCard.sender).toBeNull();
    expect(anonCard.signature_name).toBeNull();

    // author inbox sees the private message
    const inbox = await api("GET", "/me/gifts/received", authorToken);
    expect(inbox.text).toContain(secret);
    const anonInbox = inbox.json.items.find((i: { message: string }) => i.message === anonMsg);
    expect(anonInbox.sender).toBeNull();
  });

  it("does not let another user read or modify someone else's inbox item", async () => {
    const sent = await api("POST", "/gifts/send", senderToken, { author_id: authorId, gift_id: coffee.gift_id, idempotency_key: key() });
    const id = sent.json.donation.donation_id;
    expect((await api("PATCH", `/me/gifts/${id}`, senderToken, { hidden: true })).status).toBe(404);
    expect((await api("POST", `/me/gifts/${id}/thank`, senderToken, { message: "ขอบคุณ" })).status).toBe(404);

    const thanked = await api("POST", `/me/gifts/${id}/thank`, authorToken, { message: "ขอบคุณมากค่ะ" });
    expect(thanked.status).toBe(200);
    expect((await api("POST", `/me/gifts/${id}/thank`, authorToken, { message: "อีกรอบ" })).status).toBe(409);
    const note = await prisma.notification.findFirstOrThrow({ where: { user_id: senderId }, orderBy: { created_at: "desc" } });
    expect(note.content).toContain("ขอบคุณมากค่ะ");
  });
});

describe("author inbox", () => {
  it("links the author notification to the inbox and opens that envelope", async () => {
    const sent = await api("POST", "/gifts/send", senderToken, { author_id: authorId, gift_id: coffee.gift_id, idempotency_key: key() });
    const note = await prisma.notification.findFirstOrThrow({ where: { user_id: authorId }, orderBy: { created_at: "desc" } });
    expect(note.link_url).toBe(`/write/gifts?open=${sent.json.donation.donation_id}`);
  });

  it("reports stats from net coins, excluding hidden gifts", async () => {
    const before = await api("GET", "/me/gifts/stats", authorToken);
    expect(before.status).toBe(200);

    const rows = await prisma.donation.findMany({ where: { to_user_id: authorId, hidden_at: null } });
    const net = rows.reduce((sum, r) => sum + r.net_amount.toNumber(), 0);
    expect(before.json.all_time.coins_earned).toBe(net);
    expect(before.json.this_month.coins_earned).toBe(net);
    expect(before.json.unread_count).toBe(rows.filter((r) => !r.read_at).length);
    // ผู้ส่งเคยส่งทั้งแบบระบุชื่อและนิรนาม — อันดับนับเฉพาะที่ระบุชื่อ
    const named = rows.filter((r) => !r.is_anonymous).reduce((sum, r) => sum + r.amount.toNumber(), 0);
    expect(before.json.top_supporters).toEqual([expect.objectContaining({ total_coins: named })]);

    const sent = await api("POST", "/gifts/send", senderToken, { author_id: authorId, gift_id: coffee.gift_id, quantity: 4, idempotency_key: key() });
    const hide = await api("PATCH", `/me/gifts/${sent.json.donation.donation_id}`, authorToken, { hidden: true });
    expect(hide.status).toBe(200);

    const after = await api("GET", "/me/gifts/stats", authorToken);
    expect(after.json.all_time.coins_earned).toBe(net);
    const hiddenList = await api("GET", "/me/gifts/received?status=hidden", authorToken);
    expect(hiddenList.json.items.map((i: { donation_id: string }) => i.donation_id)).toContain(sent.json.donation.donation_id);
  });
});

describe("supporter badges", () => {
  it("awards Coffee Buddy only from named sends, never from anonymous ones", async () => {
    // ผู้ส่งใหม่ที่ยังไม่เคยส่งอะไร — ผลไม่ขึ้นกับเทสต์ก่อนหน้า
    const fan = await prisma.user.create({
      data: { username: `gt_fan_${tag}`, email: `gt_fan_${tag}@test.buddybook.local`, password_hash: "not-a-real-hash" },
      select: { user_id: true },
    });
    extraUserIds.push(fan.user_id);
    await prisma.walletTransaction.create({
      data: { user_id: fan.user_id, type: "topup", amount: 1000, balance_after: 1000, reference_id: crypto.randomUUID() },
    });
    const fanToken = signAccessToken({ user_id: fan.user_id, role: "user" });
    const badgeIds = async () => (await api("GET", `/users/${fan.user_id}/supporter-badges`)).json.badges.map((b: { id: string }) => b.id);
    const send = (quantity: number, is_anonymous: boolean) =>
      api("POST", "/gifts/send", fanToken, { author_id: authorId, gift_id: coffee.gift_id, quantity, idempotency_key: key(), card: { is_anonymous } });

    expect((await send(20, true)).status).toBe(201);
    expect(await badgeIds()).toEqual([]);
    expect((await send(9, false)).status).toBe(201);
    expect(await badgeIds()).not.toContain("coffee-buddy");
    expect((await send(1, false)).status).toBe(201);
    expect(await badgeIds()).toContain("coffee-buddy");
  });

  it("returns 404 for an unknown user", async () => {
    expect((await api("GET", `/users/${crypto.randomUUID()}/supporter-badges`)).status).toBe(404);
  });
});

describe("legacy POST /donations (Custom coins)", () => {
  it("still works and gives the author the full amount", async () => {
    const before = await getBalance(senderId);
    const res = await api("POST", "/donations", senderToken, { to_user_id: authorId, amount: 25, message: "เป็นกำลังใจให้" });
    expect(res.status).toBe(201);
    expect(res.json.donation_id).toBeTruthy();
    expect(res.json.gift).toBeNull();
    expect(await getBalance(senderId)).toBe(before - 25);

    const credit = await prisma.walletTransaction.findFirstOrThrow({
      where: { user_id: authorId, type: "donation_received", reference_id: res.json.donation_id },
    });
    expect(credit.amount.toNumber()).toBe(25);
  });
});

describe("rate limit", () => {
  it(`allows ${"GIFT_SEND_RATE_LIMIT_PER_MIN"} sends per minute per user`, async () => {
    const limit = env.GIFT_SEND_RATE_LIMIT_PER_MIN;
    const statuses: number[] = [];
    for (let i = 0; i <= limit; i++) {
      // ใช้ self-gift ที่ถูกปฏิเสธ (400) เพื่อไม่ให้เสียเงิน — ยังนับเป็นการยิง 1 ครั้ง
      const r = await api("POST", "/gifts/send", senderToken, { author_id: senderId, gift_id: coffee.gift_id, idempotency_key: key() });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, limit).every((s) => s === 400)).toBe(true);
    expect(statuses[limit]).toBe(429);
  });
});
