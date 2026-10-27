import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { signRefreshToken, signResetToken } from "@/lib/jwt";
import { resetRateLimits } from "@/middleware/rateLimit.middleware";
import { createHarness } from "./helpers";

const sent = vi.hoisted(() => ({ otp: new Map<string, string>(), reset: [] as string[] }));
vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => true,
  isDeliverableEmail: (to: string | null | undefined) => Boolean(to),
  sendOtpEmail: async (to: string, code: string) => {
    sent.otp.set(to, code);
  },
  sendPasswordResetEmail: async (to: string) => {
    sent.reset.push(to);
  },
  sendOAuthSignInHintEmail: async () => undefined,
  sendNovelModerationEmail: async () => undefined,
}));

const h = createHarness("demo");
const tag = crypto.randomBytes(3).toString("hex");
const PASSWORD = "Demo#Pass2026";
// สมัครได้เฉพาะโดเมนผู้ให้บริการจริง (lib/emailDomains.ts) — ส่งอีเมลถูก mock ไว้ ไม่มีอะไรออกไปจริง
const email = (name: string) => `bbtest_${name}_${tag}@gmail.com`;

async function makeUser(name: string, account_type: "DEMO" | "REAL") {
  const user = await prisma.user.create({
    data: { username: `demo_${name}_${tag}`, email: email(name), password_hash: await bcrypt.hash(PASSWORD, 4), account_type },
    select: { user_id: true },
  });
  h.userIds.push(user.user_id);
  return user.user_id;
}

let demoId = "";

beforeAll(async () => {
  await h.start();
  demoId = await makeUser("seeded", "DEMO");
  await makeUser("real", "REAL");
});

beforeEach(async () => {
  await resetRateLimits();
  sent.reset.length = 0;
});

afterAll(async () => {
  const registered = await prisma.user.findMany({ where: { email: { in: [email("signup"), email("sneaky")] } }, select: { user_id: true } });
  h.userIds.push(...registered.map((u) => u.user_id));
  await prisma.pendingRegistration.deleteMany({ where: { email: { in: [email("signup"), email("sneaky")] } } });
  await h.stop();
});

const login = (who: string, password = PASSWORD) => h.api("POST", "/auth/login", undefined, { email: email(who), password });

describe("DEMO accounts", () => {
  it("cannot log in, and get exactly the wrong-password error", async () => {
    const demo = await login("seeded");
    await resetRateLimits();
    const wrong = await login("real", "not-the-password");
    expect(demo.status).toBe(401);
    expect(demo.status).toBe(wrong.status);
    expect(demo.json).toEqual(wrong.json);
  });

  it("REAL accounts still log in", async () => {
    const res = await login("real");
    expect(res.status).toBe(200);
  });

  it("cannot refresh a token issued before the account became DEMO", async () => {
    const res = await h.api("POST", "/auth/refresh", undefined, { refresh_token: signRefreshToken({ user_id: demoId, role: "user" }) });
    expect(res.status).toBe(401);
  });

  it("gets no reset email and cannot use a reset link", async () => {
    const forgot = await h.api("POST", "/auth/password/forgot", undefined, { email: email("seeded") });
    expect(forgot.status).toBeLessThan(300);
    expect(sent.reset).toEqual([]);

    const reset = await h.api("POST", "/auth/password/reset", undefined, { token: signResetToken(demoId), new_password: "Another#Pass2026" });
    expect(reset.status).toBe(401);
    await resetRateLimits();
    expect((await login("seeded", "Another#Pass2026")).status).toBe(401);
  });
});

describe("registration", () => {
  async function register(name: string, extra: Record<string, unknown> = {}) {
    const body = { username: `demo_${name}_${tag}`, email: email(name), password: PASSWORD, ...extra };
    const otp = await h.api("POST", "/auth/register/request-otp", undefined, body);
    expect(otp.status).toBeLessThan(300);
    return h.api("POST", "/auth/register/verify-otp", undefined, { email: email(name), otp: sent.otp.get(email(name)), ...extra });
  }

  it("always creates a REAL account that can log in", async () => {
    const res = await register("signup");
    expect(res.status).toBeLessThan(300);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: email("signup") }, select: { account_type: true } });
    expect(user.account_type).toBe("REAL");
    await resetRateLimits();
    expect((await login("signup")).status).toBe(200);
  });

  it("ignores an account_type sent by the client", async () => {
    const res = await register("sneaky", { account_type: "DEMO", accountType: "DEMO" });
    expect(res.status).toBeLessThan(300);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: email("sneaky") }, select: { account_type: true } });
    expect(user.account_type).toBe("REAL");
  });

  it("rejects email domains that are not real mail providers", async () => {
    const res = await h.api("POST", "/auth/register/request-otp", undefined, {
      username: `demo_fake_${tag}`,
      email: `fake_${tag}@hippo.com`,
      password: PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(sent.otp.has(`fake_${tag}@hippo.com`)).toBe(false);
  });
});

describe("content created by REAL users", () => {
  it("is never demo, even on a DEMO novel or when the client asks for it", async () => {
    const demoNovel = await prisma.novel.create({
      data: { author_id: demoId, title: `demo novel ${tag}`, is_demo: true },
      select: { novel_id: true },
    });
    const reader = await h.createUser("reader");
    const res = await h.api("POST", `/novels/${demoNovel.novel_id}/reviews`, reader.token, { rating: 5, comment_text: "สนุกมาก", is_demo: true });
    expect(res.status).toBe(201);

    const review = await prisma.review.findFirstOrThrow({ where: { novel_id: demoNovel.novel_id, user_id: reader.id }, select: { is_demo: true } });
    expect(review.is_demo).toBe(false);

    const list = await h.api("GET", `/novels/${demoNovel.novel_id}/reviews`);
    expect(list.json.reviews[0]).toMatchObject({ is_demo: false, user: { account_type: "REAL" } });
    const detail = await h.api("GET", `/novels/${demoNovel.novel_id}`);
    expect(detail.json).toMatchObject({ is_demo: true, author: { account_type: "DEMO" } });
  });
});
