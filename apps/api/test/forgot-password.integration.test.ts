import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetRateLimits } from "@/middleware/rateLimit.middleware";
import { createHarness } from "./helpers";

const sent = vi.hoisted(() => ({ reset: [] as string[], hint: [] as { to: string; provider: string }[] }));
vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => true,
  sendOtpEmail: async () => undefined,
  sendPasswordResetEmail: async (to: string) => {
    sent.reset.push(to);
  },
  sendOAuthSignInHintEmail: async (to: string, provider: string) => {
    sent.hint.push({ to, provider });
  },
}));

const h = createHarness("forgot");
const tag = crypto.randomBytes(3).toString("hex");

async function makeUser(name: string, data: { email: string; password_hash: string | null; oauth_provider?: "google" | "line" }) {
  const user = await prisma.user.create({
    data: { username: `forgot_${name}_${tag}`, ...data },
    select: { user_id: true },
  });
  h.userIds.push(user.user_id);
}

beforeAll(async () => {
  await h.start();
  await makeUser("pw", { email: `pw_${tag}@test.buddybook.dev`, password_hash: "x" });
  await makeUser("google", { email: `g_${tag}@test.buddybook.dev`, password_hash: null, oauth_provider: "google" });
  await makeUser("line", { email: `line_${tag}@line.buddybook.local`, password_hash: null, oauth_provider: "line" });
});

beforeEach(() => {
  resetRateLimits();
  sent.reset.length = 0;
  sent.hint.length = 0;
});

afterAll(async () => {
  await h.stop();
});

const forgot = (email: string) => h.api("POST", "/auth/password/forgot", undefined, { email });

describe("forgot password", () => {
  it("sends a reset link to a password account", async () => {
    const res = await forgot(`pw_${tag}@test.buddybook.dev`);
    expect(res.status).toBeLessThan(300);
    expect(sent.reset).toEqual([`pw_${tag}@test.buddybook.dev`]);
    expect(sent.hint).toEqual([]);
  });

  it("tells an OAuth-only account which provider to use instead of staying silent", async () => {
    const res = await forgot(`g_${tag}@test.buddybook.dev`);
    expect(res.status).toBeLessThan(300);
    expect(sent.reset).toEqual([]);
    expect(sent.hint).toEqual([{ to: `g_${tag}@test.buddybook.dev`, provider: "google" }]);
  });

  it("never emails the placeholder address made for LINE accounts", async () => {
    await forgot(`line_${tag}@line.buddybook.local`);
    expect(sent.reset).toEqual([]);
    expect(sent.hint).toEqual([]);
  });

  it("answers an unknown email exactly like a known one (no account enumeration)", async () => {
    const known = await forgot(`pw_${tag}@test.buddybook.dev`);
    resetRateLimits();
    const unknown = await forgot(`nobody_${tag}@test.buddybook.dev`);
    expect(unknown.status).toBe(known.status);
    expect(unknown.json).toEqual(known.json);
  });
});
