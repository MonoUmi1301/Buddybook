import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ageOn, pickGoogleBirthday } from "@/lib/ageVerification";
import { prisma } from "@/lib/prisma";
import { loginOrRegisterWithOAuth } from "@/modules/auth/auth.service";
import { createHarness } from "./helpers";

/** gap 3.4 — ยืนยันอายุจากวันเกิดในบัญชี Google */
describe("ageOn", () => {
  const now = new Date(2026, 9, 4); // 4 ต.ค. 2026 (เวลาท้องถิ่น)
  it("counts full years by calendar date", () => {
    expect(ageOn({ year: 2008, month: 10, day: 4 }, now)).toBe(18);
    expect(ageOn({ year: 2008, month: 10, day: 5 }, now)).toBe(17);
    expect(ageOn({ year: 2008, month: 11, day: 1 }, now)).toBe(17);
  });
});

describe("pickGoogleBirthday", () => {
  it("prefers the account birthday with a year", () => {
    expect(
      pickGoogleBirthday({
        birthdays: [
          { metadata: { primary: true, source: { type: "PROFILE" } }, date: { month: 3, day: 1 } }, // ไม่มีปี — ใช้ไม่ได้
          { metadata: { source: { type: "PROFILE" } }, date: { year: 2001, month: 3, day: 1 } },
          { metadata: { source: { type: "ACCOUNT" } }, date: { year: 2000, month: 3, day: 1 } },
        ],
      })
    ).toEqual({ year: 2000, month: 3, day: 1 });
  });

  it("returns null when no birthday has a year", () => {
    expect(pickGoogleBirthday({ birthdays: [{ date: { month: 1, day: 2 } }] })).toBeNull();
    expect(pickGoogleBirthday(null)).toBeNull();
  });
});

describe("OAuth login with a verified birthday", () => {
  const h = createHarness("age");
  const email = `age_oauth_${h.tag}@test.buddybook.local`;

  beforeAll(() => h.start());
  afterAll(async () => {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) h.userIds.push(u.user_id);
    await h.stop();
    await prisma.$disconnect();
  });

  it("sets age from Google and blocks overriding it by self-declaration", async () => {
    const login = await loginOrRegisterWithOAuth({
      provider: "google",
      sub: `sub-${h.tag}`,
      email,
      name: "Teen",
      picture: null,
      birthdate: { year: new Date().getFullYear() - 15, month: 1, day: 1 },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { user_id: login.user.user_id } });
    expect(user.age_verified).toBe(false);
    expect(user.age_verification_source).toBe("google");

    const res = await h.api("PATCH", "/users/me/age-verification", login.access_token, { birth_date: "1990-01-01" });
    expect(res.status).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { user_id: user.user_id } })).age_verified).toBe(false);
  });
});
