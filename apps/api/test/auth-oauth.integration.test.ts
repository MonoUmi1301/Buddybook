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
import { loginOrRegisterWithOAuth } from "@/modules/auth/auth.service";

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
      loginOrRegisterWithOAuth(profile({ provider: "facebook", email: user.email, email_verified: false }))
    ).rejects.toMatchObject({ statusCode: 409 });
    const after = await prisma.user.findUniqueOrThrow({ where: { user_id: user.user_id } });
    expect(after.oauth_provider).toBeNull();
  });

  it("links a verified email to an existing password account (case-insensitive)", async () => {
    const user = await createUser("link");
    const p = profile({ email: `  ${user.email.toUpperCase()} ` });
    const result = await loginOrRegisterWithOAuth(p);
    expect(result.requires_2fa).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { user_id: user.user_id } });
    expect(after.oauth_provider).toBe("google");
    expect(after.oauth_id).toBe(p.sub);
  });

  it("refuses to overwrite a different provider already linked to the account", async () => {
    const user = await createUser("otherprov", { oauth_provider: "line", oauth_id: `line_${tag}` });
    await expect(loginOrRegisterWithOAuth(profile({ email: user.email }))).rejects.toMatchObject({ statusCode: 409 });
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

describe("email normalization", () => {
  it("logs in regardless of email case and surrounding spaces", async () => {
    const user = await createUser("login");
    const res = await api("POST", "/auth/login", { email: `  ${user.email.toUpperCase()}  `, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.json.user.user_id).toBe(user.user_id);
  });
});
