import crypto from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "@/app";
import { prisma } from "@/lib/prisma";
import { OAUTH_STATE_TTL_MS, createOAuthState, verifyOAuthState } from "@/lib/googleOAuth";
import type { OAuthProfile } from "@/lib/oauthProfile";
import { resetRateLimits } from "@/middleware/rateLimit.middleware";
import { loginOrRegisterWithOAuth, verifyCompleteProfileOtp } from "@/modules/auth/auth.service";
import { verifyAccessToken } from "@/lib/jwt";

/**
 * OAuth hardening — state หมดอายุ/ความยาวผิดไม่ทำให้ 500, ไม่ผูกบัญชีด้วยอีเมลที่ provider ไม่ยืนยัน,
 * ไม่เขียนทับ provider เดิม, บังคับ 2FA ตอนล็อกอินผ่าน OAuth, อีเมล normalize เป็นตัวพิมพ์เล็ก
 * ใช้ฐานข้อมูลตาม DATABASE_URL (.env) — สร้างผู้ใช้ทดสอบ (@test.buddybook.local) เองแล้วลบทิ้งตอนจบ
 */

const tag = crypto.randomBytes(4).toString("hex");
const emailOf = (name: string) => `oa_${name}_${tag}@test.buddybook.local`;
const PASSWORD = "Correct-Horse-1";

let server: Server;
let baseUrl: string;

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

function profile(overrides: Partial<OAuthProfile> & Pick<OAuthProfile, "email">): OAuthProfile {
  return {
    provider: "google",
    sub: `sub_${crypto.randomBytes(6).toString("hex")}`,
    name: "Test",
    picture: null,
    email_verified: true,
    ...overrides,
  };
}

async function createUser(name: string, data: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      username: `oa_${name}_${tag}`,
      email: emailOf(name),
      password_hash: await bcrypt.hash(PASSWORD, 4),
      ...data,
    },
  });
}

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `_${tag}@test.buddybook.local` } } });
  await prisma.user.deleteMany({ where: { line_user_id: { contains: tag } } });
  await new Promise((resolve) => server?.close(resolve));
  await prisma.$disconnect();
});

beforeEach(() => resetRateLimits());

describe("OAuth state", () => {
  it("accepts a fresh state and rejects tampered, malformed and expired ones without throwing", () => {
    const now = Date.now();
    const state = createOAuthState(now);
    expect(verifyOAuthState(state, now)).toBe(true);

    const [nonce, issuedAt, sig] = state.split(".");
    expect(verifyOAuthState(`${nonce}.${issuedAt}.${sig.slice(0, -1)}`, now)).toBe(false); // สั้นกว่า — เดิม throw
    expect(verifyOAuthState(`${nonce}.${issuedAt}.${sig}00`, now)).toBe(false); // ยาวกว่า
    expect(verifyOAuthState(`${nonce}.${Number(issuedAt) + 1}.${sig}`, now)).toBe(false); // แก้เวลา
    expect(verifyOAuthState(`${nonce}.${sig}`, now)).toBe(false); // รูปแบบเดิม 2 ส่วน
    expect(verifyOAuthState("", now)).toBe(false);
    expect(verifyOAuthState(state, now + OAUTH_STATE_TTL_MS + 1)).toBe(false); // หมดอายุ
  });

  it("returns 401 (not 500) for a state with a wrong-length signature", async () => {
    const res = await api("POST", "/auth/oauth/google/callback", { code: "x", state: "a.b" });
    expect(res.status).toBe(401);
    const state = createOAuthState();
    const bad = await api("POST", "/auth/oauth/google/callback", { code: "x", state: `${state}ff` });
    expect(bad.status).toBe(401);
  });
});

describe("loginOrRegisterWithOAuth", () => {
  it("does not link an existing account when the provider has not verified the email", async () => {
    const user = await createUser("unverified");
    await expect(
      loginOrRegisterWithOAuth(profile({ provider: "facebook", email: emailOf("unverified"), email_verified: false }))
    ).rejects.toMatchObject({ statusCode: 409 });
    const after = await prisma.user.findUniqueOrThrow({ where: { user_id: user.user_id } });
    expect(after.oauth_provider).toBeNull();
  });

  it("links a verified email to an existing password account (case-insensitive)", async () => {
    const user = await createUser("link");
    const p = profile({ email: `  ${emailOf("link").toUpperCase()} ` });
    const result = await loginOrRegisterWithOAuth(p);
    expect(result.requires_2fa).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { user_id: user.user_id } });
    expect(after.oauth_provider).toBe("google");
    expect(after.oauth_id).toBe(p.sub);
  });

  it("refuses to overwrite a different provider already linked to the account", async () => {
    const user = await createUser("otherprov", { oauth_provider: "line", oauth_id: `line_${tag}` });
    await expect(loginOrRegisterWithOAuth(profile({ email: emailOf("otherprov") }))).rejects.toMatchObject({ statusCode: 409 });
    const after = await prisma.user.findUniqueOrThrow({ where: { user_id: user.user_id } });
    expect(after.oauth_provider).toBe("line");
    expect(after.oauth_id).toBe(`line_${tag}`);
  });

  it("requires 2FA instead of issuing tokens when the account has TOTP enabled", async () => {
    const sub = `sub_2fa_${tag}`;
    await createUser("twofa", { oauth_provider: "google", oauth_id: sub, totp_enabled: true, totp_secret: "JBSWY3DPEHPK3PXP" });
    const result = await loginOrRegisterWithOAuth(profile({ email: emailOf("twofa"), sub }));
    expect(result.requires_2fa).toBe(true);
    expect(result).not.toHaveProperty("access_token");
    expect(result).toHaveProperty("challenge_token");
  });

  it("creates new accounts with a lowercased email", async () => {
    const result = await loginOrRegisterWithOAuth(profile({ email: emailOf("NewUser").toUpperCase() }));
    expect(result.requires_2fa).toBe(false);
    const created = await prisma.user.findUnique({ where: { email: emailOf("NewUser").toLowerCase() } });
    expect(created).not.toBeNull();
  });
});

/** LINE user id ทดสอบ — มี tag อยู่ในค่า afterAll ลบทิ้งด้วย line_user_id contains tag */
const lineSub = () => `U${tag}${crypto.randomBytes(12).toString("hex")}`;
const lineProfile = (overrides: Partial<OAuthProfile> = {}) =>
  profile({ provider: "line", sub: lineSub(), email: null, email_verified: false, name: "LINE User", ...overrides });

describe("LINE login without an email", () => {
  it("creates the account with email = null (no placeholder) and an email_required token", async () => {
    const p = lineProfile({ name: `มะลิ ${tag}` });
    const result = await loginOrRegisterWithOAuth(p);
    if (result.requires_2fa) throw new Error("unexpected 2FA");
    expect(result.needs_email).toBe(true);
    expect(verifyAccessToken(result.access_token).email_required).toBe(true);

    const created = await prisma.user.findUniqueOrThrow({ where: { line_user_id: p.sub } });
    expect(created.email).toBeNull();
    expect(created.username).toBe(`มะลิ_${tag}`);

    // ล็อกอินซ้ำเจอบัญชีเดิมจาก line_user_id ไม่สร้างใหม่
    await loginOrRegisterWithOAuth(p);
    expect(await prisma.user.count({ where: { line_user_id: p.sub } })).toBe(1);
  });

  it("falls back to a readable default when the display name has nothing usable", async () => {
    const p = lineProfile({ name: "🙂" });
    await loginOrRegisterWithOAuth(p);
    const created = await prisma.user.findUniqueOrThrow({ where: { line_user_id: p.sub } });
    expect(created.username).toMatch(/^reader\d*$/);
  });

  it("gives a second LINE account with the same display name a numeric suffix", async () => {
    const name = `dup ${tag}`;
    const [a, b] = [lineProfile({ name }), lineProfile({ name })];
    await loginOrRegisterWithOAuth(a);
    await loginOrRegisterWithOAuth(b);
    const second = await prisma.user.findUniqueOrThrow({ where: { line_user_id: b.sub } });
    expect(second.username).toMatch(new RegExp(`^dup_${tag}[0-9]+$`));
  });

  it("blocks every other endpoint with 403 EMAIL_REQUIRED until an email is verified", async () => {
    const p = lineProfile();
    const result = await loginOrRegisterWithOAuth(p);
    if (result.requires_2fa) throw new Error("unexpected 2FA");
    const auth = { Authorization: `Bearer ${result.access_token}` };

    const me = await fetch(`${baseUrl}/api/v1/users/me`, { headers: auth });
    expect(me.status).toBe(403);
    expect(((await me.json()) as { details?: { code?: string } }).details?.code).toBe("EMAIL_REQUIRED");

    // อีเมลที่มีบัญชีอยู่แล้ว → 409 ไม่เขียนทับ
    const owner = await createUser("taken");
    const taken = await fetch(`${baseUrl}/api/v1/auth/complete-profile/request-otp`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ email: owner.email }),
    });
    expect(taken.status).toBe(409);
    expect(((await taken.json()) as { error: string }).error).toBe("อีเมลนี้มีบัญชีอยู่แล้ว");

    // OTP ถูก → บันทึกอีเมล + token ใหม่ไม่มี email_required แล้ว endpoint อื่นใช้ได้
    const user = await prisma.user.findUniqueOrThrow({ where: { line_user_id: p.sub } });
    const email = emailOf("completed");
    await prisma.pendingEmailVerification.create({
      data: { user_id: user.user_id, email, otp_hash: await bcrypt.hash("123456", 4), expires_at: new Date(Date.now() + 60_000) },
    });
    await expect(verifyCompleteProfileOtp(user.user_id, "000000")).rejects.toMatchObject({ statusCode: 401 });
    const done = await verifyCompleteProfileOtp(user.user_id, "123456");
    expect(verifyAccessToken(done.access_token).email_required).toBeUndefined();
    expect((await prisma.user.findUniqueOrThrow({ where: { user_id: user.user_id } })).email).toBe(email);
    const meAfter = await fetch(`${baseUrl}/api/v1/users/me`, { headers: { Authorization: `Bearer ${done.access_token}` } });
    expect(meAfter.status).toBe(200);
  });

  it("refuses to save an email another account took while the OTP was pending", async () => {
    const p = lineProfile();
    await loginOrRegisterWithOAuth(p);
    const user = await prisma.user.findUniqueOrThrow({ where: { line_user_id: p.sub } });
    const owner = await createUser("race");
    await prisma.pendingEmailVerification.create({
      data: { user_id: user.user_id, email: emailOf("race"), otp_hash: await bcrypt.hash("123456", 4), expires_at: new Date(Date.now() + 60_000) },
    });
    await expect(verifyCompleteProfileOtp(user.user_id, "123456")).rejects.toMatchObject({ statusCode: 409 });
    expect((await prisma.user.findUniqueOrThrow({ where: { user_id: user.user_id } })).email).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { user_id: owner.user_id } })).email).toBe(emailOf("race"));
  });
});

describe("LINE login with an email", () => {
  it("links LINE to the existing account with that email instead of creating a new one", async () => {
    const user = await createUser("linelink", { oauth_provider: "google", oauth_id: `g_${tag}` });
    const p = lineProfile({ email: emailOf("linelink").toUpperCase(), email_verified: true });
    const result = await loginOrRegisterWithOAuth(p);
    expect(result.requires_2fa).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { user_id: user.user_id } });
    expect(after.line_user_id).toBe(p.sub);
    expect(after.oauth_provider).toBe("google"); // ช่องทางเดิมไม่ถูกเขียนทับ
    expect(await prisma.user.count({ where: { line_user_id: p.sub } })).toBe(1);
  });

  it("fills in the email of a LINE account that had none once LINE shares it", async () => {
    const p = lineProfile();
    await loginOrRegisterWithOAuth(p);
    const email = emailOf("lateemail");
    const result = await loginOrRegisterWithOAuth({ ...p, email, email_verified: true });
    if (result.requires_2fa) throw new Error("unexpected 2FA");
    expect(result.needs_email).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { line_user_id: p.sub } })).email).toBe(email);
  });
});

describe("usernames from the provider's display name", () => {
  it("names a Facebook/Google account after its display name, not the email", async () => {
    const email = `fbname_${tag}@example.com`;
    try {
      await loginOrRegisterWithOAuth(profile({ provider: "facebook", sub: `fb_${tag}`, email, name: `Hobi Kawaii ${tag}` }));
      const created = await prisma.user.findUnique({ where: { email }, select: { username: true } });
      expect(created?.username).toBe(`Hobi_Kawaii_${tag}`);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  it("uses the email prefix when the provider sends only a placeholder name", async () => {
    const email = `fbnoname${tag}@example.com`;
    try {
      await loginOrRegisterWithOAuth(profile({ provider: "facebook", sub: `fb2_${tag}`, email, name: "Facebook User" }));
      const created = await prisma.user.findUnique({ where: { email }, select: { username: true } });
      expect(created?.username).toBe(`fbnoname${tag}`);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });
});

describe("email normalization", () => {
  it("logs in regardless of email case and surrounding spaces", async () => {
    const user = await createUser("login");
    const res = await api("POST", "/auth/login", { email: `  ${emailOf("login").toUpperCase()}  `, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.json.user.user_id).toBe(user.user_id);
  });
});
