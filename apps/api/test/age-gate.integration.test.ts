import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseBirthDate } from "@/lib/ageVerification";
import { allowedRatings, canViewRating } from "@/lib/contentRating";
import { createOAuthState } from "@/lib/googleOAuth";
import { prisma } from "@/lib/prisma";
import { createHarness } from "./helpers";

// ยืนยันอายุด้วย Google — ไม่ยิง Google จริง: code "teen"/"adult"/"nobday" แทนวันเกิดที่ People API ตอบมา
vi.mock("@/lib/googleOAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/googleOAuth")>();
  const year = new Date().getFullYear();
  return {
    ...actual,
    exchangeGoogleCode: vi.fn(async (code: string) => ({
      provider: "google" as const,
      sub: `sub-${code}`,
      email: `${code}@gmail.test`,
      name: code,
      picture: null,
      email_verified: true,
      birthdate:
        code === "nobday" ? null : { year: code === "teen" ? year - 15 : year - 30, month: 1, day: 1 },
    })),
  };
});

/** เกตเรตเนื้อหาตามอายุที่ยืนยันแล้ว: all_ages ทุกคน, teen 13+, mature 18+ (ยังไม่ยืนยัน = all_ages เท่านั้น)
 *  ครอบทุก endpoint ที่ผูกกับนิยาย + การยืนยันอายุ (กรอกเองครั้งเดียว / Google ทับได้) */
describe("rating rules", () => {
  it("maps verified age to allowed ratings", () => {
    expect(allowedRatings(null)).toEqual(["all_ages"]);
    expect(allowedRatings(12)).toEqual(["all_ages"]);
    expect(allowedRatings(13)).toEqual(["all_ages", "teen"]);
    expect(allowedRatings(18)).toEqual(["all_ages", "teen", "mature"]);
    expect(canViewRating("teen", 17)).toBe(true);
    expect(canViewRating("mature", 17)).toBe(false);
  });
});

describe("parseBirthDate", () => {
  const now = new Date(2026, 9, 24);
  it("accepts a real past date", () => {
    expect(parseBirthDate("2000-02-29", now)).toEqual({ year: 2000, month: 2, day: 29 });
  });
  it("rejects loose, impossible, future and implausible dates", () => {
    for (const v of ["1", "2001", "2000-1-1", "2001-02-29", "2000-13-01", "2999-01-01", "0001-01-01", "1900-01-01"]) {
      expect(parseBirthDate(v, now), v).toBeNull();
    }
  });
});

describe("content rating gate", () => {
  const h = createHarness("agegate");
  type U = { id: string; token: string };
  let author: U, unverified: U, kid: U, teen: U, adult: U, legacyAdult: U;
  const novels: Record<"all_ages" | "teen" | "mature", { novel_id: string; chapter_id: string; title: string }> =
    {} as never;
  const year = new Date().getFullYear();

  const withBirthDate = async (name: string, age: number) => {
    const u = await h.createUser(name);
    await prisma.user.update({
      where: { user_id: u.id },
      data: { birth_date: new Date(Date.UTC(year - age, 0, 1)), age_verified: age >= 18, age_verification_source: "self_declared" },
    });
    return u;
  };

  beforeAll(async () => {
    await h.start();
    author = await h.createUser("author");
    unverified = await h.createUser("unverified");
    kid = await withBirthDate("kid", 10);
    teen = await withBirthDate("teen", 15);
    adult = await withBirthDate("adult", 30);
    legacyAdult = await h.createUser("legacy", { age_verified: true }); // ยืนยันก่อนมี birth_date
    for (const rating of ["all_ages", "teen", "mature"] as const) {
      const title = `RATING_${rating}_${h.tag}`;
      const novel = await prisma.novel.create({
        data: { author_id: author.id, title, content_rating: rating, visibility: "published" },
      });
      const chapter = await prisma.chapter.create({
        data: { novel_id: novel.novel_id, chapter_number: 1, title: "ch1", status: "published", content: "<p>x</p>" },
      });
      await prisma.comment.create({ data: { chapter_id: chapter.chapter_id, user_id: author.id, content: "c" } });
      await prisma.review.create({ data: { novel_id: novel.novel_id, user_id: author.id, rating: 5 } });
      novels[rating] = { novel_id: novel.novel_id, chapter_id: chapter.chapter_id, title };
    }
  });

  afterAll(async () => {
    await h.stop();
    await prisma.$disconnect();
  });

  const paths = (r: keyof typeof novels) => [
    `/novels/${novels[r].novel_id}`,
    `/chapters/${novels[r].chapter_id}`,
    `/novels/${novels[r].novel_id}/chapters`,
    `/novels/${novels[r].novel_id}/comments`,
    `/novels/${novels[r].novel_id}/reviews`,
    `/novels/${novels[r].novel_id}/donations`,
    `/chapters/${novels[r].chapter_id}/comments`,
  ];

  it("gates every novel endpoint by the viewer's verified age", async () => {
    const cases: [string, string | undefined, Record<keyof typeof novels, number | string>][] = [
      ["guest", undefined, { all_ages: 200, teen: "AGE_VERIFICATION_REQUIRED", mature: "AGE_VERIFICATION_REQUIRED" }],
      ["unverified", unverified.token, { all_ages: 200, teen: "AGE_VERIFICATION_REQUIRED", mature: "AGE_VERIFICATION_REQUIRED" }],
      ["kid (10)", kid.token, { all_ages: 200, teen: "AGE_RESTRICTED", mature: "AGE_RESTRICTED" }],
      ["teen (15)", teen.token, { all_ages: 200, teen: 200, mature: "AGE_RESTRICTED" }],
      ["adult (30)", adult.token, { all_ages: 200, teen: 200, mature: 200 }],
      ["legacy adult", legacyAdult.token, { all_ages: 200, teen: 200, mature: 200 }],
      ["author", author.token, { all_ages: 200, teen: 200, mature: 200 }],
    ];
    for (const [who, token, expected] of cases) {
      for (const rating of ["all_ages", "teen", "mature"] as const) {
        for (const path of paths(rating)) {
          const res = await h.api("GET", path, token);
          const want = expected[rating];
          if (want === 200) {
            expect(res.status, `${who} ${rating} ${path}`).toBe(200);
          } else {
            expect(res.status, `${who} ${rating} ${path}`).toBe(403);
            expect(res.json.details, `${who} ${rating} ${path}`).toEqual({
              code: want,
              required_age: rating === "teen" ? 13 : 18,
            });
          }
        }
      }
    }
  });

  it("filters search and the author's profile by verified age", async () => {
    const searchTitles = async (token?: string) =>
      ((await h.api("GET", `/novels/search?q=RATING_&pageSize=50`, token)).json.novels as { title: string }[])
        .map((n) => n.title)
        .filter((t) => t.endsWith(h.tag));
    const profileTitles = async (token?: string) =>
      ((await h.api("GET", `/users/${author.id}`, token)).json.novels as { title: string }[]).map((n) => n.title);
    const t = (...r: (keyof typeof novels)[]) => r.map((x) => novels[x].title).sort();

    for (const list of [searchTitles, profileTitles]) {
      expect((await list()).sort()).toEqual(t("all_ages"));
      expect((await list(kid.token)).sort()).toEqual(t("all_ages"));
      expect((await list(teen.token)).sort()).toEqual(t("all_ages", "teen"));
      expect((await list(adult.token)).sort()).toEqual(t("all_ages", "teen", "mature"));
    }
    expect((await profileTitles(author.token)).sort()).toEqual(t("all_ages", "teen", "mature"));
  });

  it("rejects malformed birth dates without recording anything", async () => {
    for (const birth_date of ["1", "0001-01-01", "2999-01-01", "2001-02-30"]) {
      const res = await h.api("PATCH", "/users/me/age-verification", unverified.token, { birth_date });
      expect(res.status, birth_date).toBe(400);
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { user_id: unverified.id } });
    expect(user.age_verification_source).toBeNull();
    expect(user.birth_date).toBeNull();
  });

  it("allows self-declaring once and stores the birth date", async () => {
    const first = await h.api("PATCH", "/users/me/age-verification", unverified.token, { birth_date: `${year - 15}-01-01` });
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ age_verified: false, source: "self_declared" });
    expect(first.json.age).toBeGreaterThanOrEqual(15);

    // teen 13+ เปิดทันที, 18+ ยังไม่ได้ และกรอกใหม่ด้วยปีอื่นไม่ได้
    expect((await h.api("GET", `/chapters/${novels.teen.chapter_id}`, unverified.token)).status).toBe(200);
    const retry = await h.api("PATCH", "/users/me/age-verification", unverified.token, { birth_date: "1990-01-01" });
    expect(retry.status).toBe(409);
    expect((await h.api("GET", `/chapters/${novels.mature.chapter_id}`, unverified.token)).json.details.code).toBe(
      "AGE_RESTRICTED"
    );

    const me = await h.api("GET", "/users/me", unverified.token);
    expect(me.json).toMatchObject({ age_verification_source: "self_declared", age_verified: false });
    expect(me.json.verified_age).toBeGreaterThanOrEqual(15);
  });

  it("verifies with Google for the signed-in account and overrides a self-declared date", async () => {
    // บัญชีนี้กรอกเองว่า 15 ไว้แล้ว (เทสต์ก่อนหน้า) — Google ยืนยันว่า 30 ทับได้
    const res = await h.api("POST", "/users/me/age-verification/google", unverified.token, {
      code: "adult",
      state: createOAuthState(),
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ age_verified: true, source: "google" });
    expect((await h.api("GET", `/chapters/${novels.mature.chapter_id}`, unverified.token)).status).toBe(200);
    // ไม่ได้ล็อกอิน/ผูกบัญชี Google — oauth_id ของบัญชีนี้ไม่เปลี่ยน
    const user = await prisma.user.findUniqueOrThrow({ where: { user_id: unverified.id } });
    expect(user.oauth_id).toBeNull();

    // ยืนยันด้วย Google แล้ว กรอกเองทับไม่ได้
    const self = await h.api("PATCH", "/users/me/age-verification", unverified.token, { birth_date: `${year - 10}-01-01` });
    expect(self.status).toBe(409);
  });

  it("records an underage Google birthday as restricted", async () => {
    const res = await h.api("POST", "/users/me/age-verification/google", kid.token, { code: "teen", state: createOAuthState() });
    expect(res.status).toBe(200);
    expect((await h.api("GET", `/chapters/${novels.teen.chapter_id}`, kid.token)).status).toBe(200);
    expect((await h.api("GET", `/chapters/${novels.mature.chapter_id}`, kid.token)).json.details.code).toBe("AGE_RESTRICTED");
  });

  it("rejects Google verification without a birthday, a bad state, or no session", async () => {
    const noBday = await h.api("POST", "/users/me/age-verification/google", adult.token, {
      code: "nobday",
      state: createOAuthState(),
    });
    expect(noBday.status).toBe(422);
    const badState = await h.api("POST", "/users/me/age-verification/google", adult.token, { code: "adult", state: "x.y.z" });
    expect(badState.status).toBe(401);
    const guest = await h.api("POST", "/users/me/age-verification/google", undefined, { code: "adult", state: createOAuthState() });
    expect(guest.status).toBe(401);
  });

  it("asks Google for the birthday scope when starting age verification", async () => {
    const res = await h.api("GET", "/auth/oauth/google?purpose=verify_age");
    if (res.status === 400) return; // GOOGLE_CLIENT_ID ไม่ได้ตั้งในเครื่องนี้
    expect(res.status).toBe(200);
    expect(new URL(res.json.redirect_url).searchParams.get("scope")).toContain("user.birthday.read");
    expect((await h.api("GET", "/auth/oauth/line?purpose=verify_age")).status).toBe(400);
  });
});
