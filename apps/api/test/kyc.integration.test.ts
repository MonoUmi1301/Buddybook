import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { KYC_CONSENT_VERSION } from "@/lib/kyc/consent";
import { evaluateKycReview, hashDocumentNumber, isValidThaiNationalId, type KycReview } from "@/lib/kyc/evaluate";
import { canonicalWebhookBody, toKycReview, verifyDiditWebhook, type DiditDecision } from "@/lib/kyc/didit";
import { createHarness } from "./helpers";

// ผู้ให้บริการจำลอง: ไม่เรียก Didit จริง — decisions[session_id] คือผลที่ GET decision จะตอบ
const decisions = new Map<string, DiditDecision>();
const sessionsByRef = new Map<string, string>();
const deleted: string[] = [];
const createdCallbacks: string[] = [];
vi.mock("@/lib/kyc/didit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/kyc/didit")>();
  const { ApiError } = await import("@/utils/ApiError");
  return {
    ...actual,
    createDiditSession: vi.fn(async (ref: string, callback: string) => {
      createdCallbacks.push(callback);
      // Didit คืน session เดิมถ้ายังไม่จบ (idempotent ตาม vendor_data)
      const existing = sessionsByRef.get(ref);
      const sessionId = existing && !deleted.includes(existing) ? existing : crypto.randomUUID();
      sessionsByRef.set(ref, sessionId);
      return { sessionId, url: `https://verify.didit.me/session/${sessionId}` };
    }),
    getDiditDecision: vi.fn(async (sessionId: string) => {
      const d = decisions.get(sessionId);
      if (!d) throw ApiError.notFound("ไม่พบข้อมูลการยืนยันตัวตน");
      return d;
    }),
    deleteDiditSession: vi.fn(async (sessionId: string) => {
      deleted.push(sessionId);
    }),
  };
});

const year = new Date().getFullYear();
const VALID_THAI_ID = "1101700207030";
const OTHER_THAI_ID = "3109900123453";

function approvedDecision(sessionId: string, dob: string, personal = VALID_THAI_ID, docType = "Identity Card"): DiditDecision {
  return {
    session_id: sessionId,
    status: "Approved",
    id_verifications: [
      {
        status: "Approved",
        document_type: docType,
        issuing_state: "THA",
        document_number: "JT0123456789", // เลขหลังบัตร (ไม่ใช่เลขประจำตัว)
        personal_number: personal,
        date_of_birth: dob,
        expiration_date: `${year + 5}-01-01`,
      },
    ],
    liveness_checks: [{ status: "Approved" }],
    face_matches: [{ status: "Approved" }],
  };
}

describe("Validating age logic (evaluateKycReview)", () => {
  const now = new Date(2026, 9, 24);
  const base = toKycReview(approvedDecision("s", "2000-05-14"));

  it("approves a Thai ID with a consistent birth date and picks the checksum-valid 13-digit number", () => {
    expect(evaluateKycReview(base, now)).toEqual({
      outcome: "approved",
      birth: { year: 2000, month: 5, day: 14 },
      documentType: "ID_CARD",
      documentCountry: "THA",
      documentNumber: VALID_THAI_ID,
    });
  });

  it("maps Didit session statuses", () => {
    const of = (status: string) => evaluateKycReview(toKycReview({ session_id: "s", status }), now);
    for (const s of ["Not Started", "In Progress", "In Review", "Awaiting User", "Resubmitted"]) {
      expect(of(s), s).toEqual({ outcome: "pending" });
    }
    expect(of("Declined")).toEqual({ outcome: "rejected", reason: "PROVIDER_REJECTED", retryAllowed: true });
    for (const s of ["Expired", "Abandoned", "Kyc Expired"]) {
      expect(of(s), s).toEqual({ outcome: "rejected", reason: "SESSION_EXPIRED", retryAllowed: true });
    }
  });

  it("re-checks the result even when the provider says Approved", () => {
    const approved = base as Extract<KycReview, { state: "approved" }>;
    const withDoc = (doc: object) =>
      evaluateKycReview({ ...approved, documents: [{ ...approved.documents[0], ...doc }] }, now);
    expect(evaluateKycReview({ ...approved, livenessPassed: false }, now)).toMatchObject({ reason: "INCOMPLETE_CHECKS" });
    expect(evaluateKycReview({ ...approved, faceMatchPassed: false }, now)).toMatchObject({ reason: "INCOMPLETE_CHECKS" });
    expect(withDoc({ type: null })).toMatchObject({ reason: "UNSUPPORTED_DOCUMENT" });
    expect(withDoc({ birthDate: null })).toMatchObject({ reason: "NO_BIRTH_DATE" });
    expect(withDoc({ birthDate: "2999-01-01" })).toMatchObject({ reason: "INVALID_BIRTH_DATE" });
    expect(withDoc({ validUntil: "2020-01-01" })).toMatchObject({ reason: "DOCUMENT_EXPIRED", retryAllowed: true });
    expect(withDoc({ numbers: ["1101700207031", "JT0123456789"] })).toMatchObject({ reason: "INVALID_ID_NUMBER" });
    expect(
      evaluateKycReview({ ...approved, documents: [approved.documents[0], { ...approved.documents[0], birthDate: "2000-05-15" }] }, now)
    ).toMatchObject({ reason: "BIRTH_DATE_MISMATCH", retryAllowed: false });
    // พาสปอร์ตไม่ใช้ checksum บัตรประชาชนไทย
    expect(withDoc({ type: "PASSPORT", numbers: ["AA1234567"] })).toMatchObject({ outcome: "approved", documentType: "PASSPORT" });
  });

  it("treats missing liveness / face match results as incomplete", () => {
    const d = { ...approvedDecision("s", "2000-05-14"), liveness_checks: null };
    expect(evaluateKycReview(toKycReview(d), now)).toMatchObject({ reason: "INCOMPLETE_CHECKS" });
  });

  it("validates the Thai national ID checksum", () => {
    expect(isValidThaiNationalId(VALID_THAI_ID)).toBe(true);
    expect(isValidThaiNationalId(OTHER_THAI_ID)).toBe(true);
    expect(isValidThaiNationalId("1101700207031")).toBe(false);
    expect(isValidThaiNationalId("12345")).toBe(false);
  });

  it("hashes document numbers with a secret key (not plain SHA-256)", () => {
    const a = hashDocumentNumber("THA", "ID_CARD", VALID_THAI_ID, "k".repeat(32));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(crypto.createHash("sha256").update(VALID_THAI_ID).digest("hex"));
    expect(a).not.toBe(hashDocumentNumber("THA", "ID_CARD", VALID_THAI_ID, "j".repeat(32)));
  });
});

describe("Didit webhook signature", () => {
  // ค่าคาดหวังคำนวณแยกด้วย Python (json.dumps sort_keys, ensure_ascii=False / raw bytes) ด้วย secret "whsec"
  const raw = Buffer.from(
    '{"webhook_type":"status.updated","timestamp":1800000000,"session_id":"s-1","status":"Approved","decision":{"z":1,"a":"ไทย"}}'
  );
  const v2 = "5f37653504084667396f4f31919d994d726d7bfd47df483b561f5b707dc3706f";
  const rawSig = "2ae9c5eea856e5f6d20ba6d0c3f121c8ce53bc798467b6c62493a18e2414fd15";
  const now = 1_800_000_000;

  it("builds the canonical body like Didit (sorted keys, unescaped Unicode)", () => {
    expect(canonicalWebhookBody(JSON.parse(raw.toString("utf8")))).toBe(
      '{"decision":{"a":"ไทย","z":1},"session_id":"s-1","status":"Approved","timestamp":1800000000,"webhook_type":"status.updated"}'
    );
  });

  it("accepts X-Signature-V2, the raw-body X-Signature, and the -Previous headers after a secret rotation", () => {
    expect(verifyDiditWebhook(raw, { signatureV2: v2 }, "whsec", now)?.session_id).toBe("s-1");
    expect(verifyDiditWebhook(raw, { signature: rawSig }, "whsec", now)).not.toBeNull();
    expect(verifyDiditWebhook(raw, { signatureV2: "00", signatureV2Previous: v2.toUpperCase() }, "whsec", now)).not.toBeNull();
    expect(verifyDiditWebhook(raw, { signaturePrevious: rawSig }, "whsec", now + 299)).not.toBeNull();
  });

  it("rejects tampering, a stale signed timestamp, a wrong secret, and missing signatures", () => {
    const tampered = Buffer.from(raw.toString("utf8").replace('"Approved"', '"Declined"'));
    expect(verifyDiditWebhook(tampered, { signatureV2: v2, signature: rawSig }, "whsec", now)).toBeNull();
    // ความสดมาจาก timestamp ใน body (ถูกเซ็น) — เลยเวลา 5 นาทีแล้วต่อให้ลายเซ็นถูกก็ไม่รับ
    expect(verifyDiditWebhook(raw, { signatureV2: v2 }, "whsec", now + 301)).toBeNull();
    expect(verifyDiditWebhook(raw, { signatureV2: v2 }, "other", now)).toBeNull();
    expect(verifyDiditWebhook(raw, {}, "whsec", now)).toBeNull();
    expect(verifyDiditWebhook(raw, { signatureV2: v2 }, "", now)).toBeNull();
    expect(verifyDiditWebhook(Buffer.from("not json"), { signatureV2: v2 }, "whsec", now)).toBeNull();
  });
});

describe("e-KYC flow (Didit)", () => {
  const h = createHarness("kyc");
  type U = { id: string; token: string };
  let alice: U, bob: U, carol: U, teen: U, dave: U;
  let matureChapterId = "";
  const saved = { ...env };

  // เซ็นแบบ X-Signature-V2 (canonical JSON) — timestamp อยู่ใน body ตามที่ Didit ส่งจริง
  const postWebhook = (payload: object, secret = "whsec-test", ts = Math.floor(Date.now() / 1000)) => {
    const body = { ...payload, timestamp: ts };
    return h.api("POST", "/webhooks/kyc/didit", undefined, JSON.stringify(body), {
      "X-Signature-V2": crypto.createHmac("sha256", secret).update(canonicalWebhookBody(body), "utf8").digest("hex"),
    });
  };
  const start = (u: U, body: object = { consent: true, consent_version: KYC_CONSENT_VERSION, return_to: "/novels/x" }) =>
    h.api("POST", "/kyc/session", u.token, body);
  const sessionOf = async (u: U) =>
    (await prisma.kycVerification.findFirstOrThrow({ where: { user_id: u.id }, orderBy: { created_at: "desc" } }))
      .provider_session_id!;
  const statusWebhook = async (u: U) =>
    postWebhook({ webhook_type: "status.updated", session_id: await sessionOf(u), status: "Approved" });

  beforeAll(async () => {
    Object.assign(env, {
      KYC_PROVIDER: "didit",
      DIDIT_API_KEY: "api-key",
      DIDIT_WORKFLOW_ID: "workflow",
      DIDIT_WEBHOOK_SECRET: "whsec-test",
      KYC_ID_HASH_SECRET: "h".repeat(40),
    });
    await h.start();
    alice = await h.createUser("alice");
    bob = await h.createUser("bob");
    carol = await h.createUser("carol");
    teen = await h.createUser("teen");
    dave = await h.createUser("dave");
    const novel = await prisma.novel.create({
      data: { author_id: dave.id, title: `KYC_MATURE_${h.tag}`, content_rating: "mature", visibility: "published" },
    });
    matureChapterId = (
      await prisma.chapter.create({
        data: { novel_id: novel.novel_id, chapter_number: 1, title: "c", status: "published", content: "<p>x</p>" },
      })
    ).chapter_id;
  });

  afterAll(async () => {
    Object.assign(env, saved);
    await h.stop();
    await prisma.$disconnect();
  });

  it("requires explicit consent with the current consent version", async () => {
    expect((await start(alice, { consent: false, consent_version: KYC_CONSENT_VERSION })).status).toBe(400);
    expect((await start(alice, { consent: true, consent_version: "old" })).status).toBe(400);
    expect(await prisma.kycVerification.count({ where: { user_id: alice.id } })).toBe(0);
  });

  it("creates a Didit session, records consent, and never sends our user_id to the provider", async () => {
    const res = await start(alice);
    expect(res.status).toBe(200);
    const row = await prisma.kycVerification.findFirstOrThrow({ where: { user_id: alice.id } });
    expect(res.json.url).toBe(`https://verify.didit.me/session/${row.provider_session_id}`);
    expect(row.external_ref).not.toBe(alice.id);
    expect(row).toMatchObject({ status: "pending", consent_version: KYC_CONSENT_VERSION, provider: "didit" });
    // callback กลับมาหน้า /verify-identity พร้อม return_to ที่ผ่านการตรวจ — path ภายนอกถูกแทนด้วย /settings
    expect(createdCallbacks.at(-1)).toBe(`${env.APP_URL}/verify-identity?return_to=%2Fnovels%2Fx`);
    await start(alice, { consent: true, consent_version: KYC_CONSENT_VERSION, return_to: "//evil.example" });
    expect(createdCallbacks.at(-1)).toBe(`${env.APP_URL}/verify-identity?return_to=%2Fsettings`);
    // ทำต่อจากเดิม = session เดิม
    expect(await sessionOf(alice)).toBe(row.provider_session_id);
    expect((await h.api("GET", "/kyc/status", alice.token)).json).toMatchObject({ enabled: true, status: "pending" });
  });

  it("rejects webhooks with a bad signature or a stale timestamp", async () => {
    const payload = { webhook_type: "status.updated", session_id: await sessionOf(alice), status: "Approved" };
    expect((await postWebhook(payload, "wrong-secret")).status).toBe(401);
    expect((await postWebhook(payload, "whsec-test", Math.floor(Date.now() / 1000) - 600)).status).toBe(401);
  });

  it("approves on a signed webhook, keeps only the minimum, deletes the provider session, and unlocks 18+", async () => {
    const sid = await sessionOf(alice);
    decisions.set(sid, approvedDecision(sid, `${year - 25}-03-01`));
    expect((await h.api("GET", `/chapters/${matureChapterId}`, alice.token)).status).toBe(403);

    const res = await statusWebhook(alice);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ handled: true });

    const row = await prisma.kycVerification.findFirstOrThrow({ where: { user_id: alice.id } });
    expect(row).toMatchObject({ status: "approved", document_type: "ID_CARD", document_country: "THA" });
    expect(row.id_number_hash).toMatch(/^[0-9a-f]{64}$/);
    // data minimization — ไม่มีเลขบัตร/เลขหลังบัตรตัวจริงอยู่ที่ไหนในแถว และสั่งลบข้อมูลฝั่ง Didit แล้ว
    expect(JSON.stringify(row)).not.toContain(VALID_THAI_ID);
    expect(JSON.stringify(row)).not.toContain("JT0123456789");
    expect(deleted).toContain(sid);

    const user = await prisma.user.findUniqueOrThrow({ where: { user_id: alice.id } });
    expect(user.age_verification_source).toBe("kyc");
    expect(user.birth_date?.toISOString().slice(0, 10)).toBe(`${year - 25}-03-01`);
    expect((await h.api("GET", `/chapters/${matureChapterId}`, alice.token)).status).toBe(200);

    // webhook ซ้ำ = ไม่เปลี่ยนอะไร (idempotent)
    expect((await statusWebhook(alice)).status).toBe(200);
    expect(await prisma.kycVerification.count({ where: { user_id: alice.id, status: "approved" } })).toBe(1);
  });

  it("won't let a verified account start again", async () => {
    expect((await start(alice)).status).toBe(409);
  });

  it("rejects the same document on a second account", async () => {
    await start(bob);
    const sid = await sessionOf(bob);
    decisions.set(sid, approvedDecision(sid, `${year - 25}-03-01`)); // บัตรใบเดียวกับ alice
    await statusWebhook(bob);
    const row = await prisma.kycVerification.findFirstOrThrow({ where: { user_id: bob.id } });
    expect(row).toMatchObject({ status: "rejected", reject_reason: "DUPLICATE_IDENTITY", retry_allowed: false });
    expect((await prisma.user.findUniqueOrThrow({ where: { user_id: bob.id } })).age_verification_source).toBeNull();
    expect((await start(bob)).status).toBe(409);
  });

  it("lets a declined user start a new session, and picks up the result by polling", async () => {
    await start(carol);
    const first = await sessionOf(carol);
    decisions.set(first, { session_id: first, status: "Declined" });
    await statusWebhook(carol);
    expect((await h.api("GET", "/kyc/status", carol.token)).json).toMatchObject({
      status: "rejected",
      reject_reason: "PROVIDER_REJECTED",
      retry_allowed: true,
    });
    expect(deleted).toContain(first);

    expect((await start(carol)).status).toBe(200);
    const second = await sessionOf(carol);
    expect(second).not.toBe(first);
    // ไม่มี webhook (เช่นตอนพัฒนาบน localhost) — GET /kyc/status ดึงผลเองเมื่อรอเกิน 10 วินาที
    decisions.set(second, approvedDecision(second, `${year - 30}-01-01`, OTHER_THAI_ID));
    await prisma.kycVerification.updateMany({ where: { provider_session_id: second }, data: { updated_at: new Date(Date.now() - 60_000) } });
    expect((await h.api("GET", "/kyc/status", carol.token)).json).toMatchObject({ status: "approved", document_type: "ID_CARD" });
  });

  it("records an underage passport as restricted", async () => {
    await start(teen);
    const sid = await sessionOf(teen);
    decisions.set(sid, approvedDecision(sid, `${year - 15}-01-01`, "AB1234567", "Passport"));
    await statusWebhook(teen);
    const res = await h.api("GET", `/chapters/${matureChapterId}`, teen.token);
    expect(res.status).toBe(403);
    expect(res.json.details.code).toBe("AGE_RESTRICTED");
  });

  it("ignores unknown sessions and other webhook types", async () => {
    expect((await postWebhook({ webhook_type: "status.updated", session_id: crypto.randomUUID() })).json).toEqual({ handled: false });
    expect((await postWebhook({ webhook_type: "data.updated", session_id: await sessionOf(teen) })).json).toEqual({ handled: false });
  });

  it("erases our KYC data, deletes provider sessions, and removes the age it granted", async () => {
    deleted.length = 0;
    expect((await h.api("DELETE", "/kyc", alice.token)).status).toBe(204);
    expect(deleted.length).toBeGreaterThan(0);
    expect(await prisma.kycVerification.count({ where: { user_id: alice.id } })).toBe(0);
    const user = await prisma.user.findUniqueOrThrow({ where: { user_id: alice.id } });
    expect(user).toMatchObject({ birth_date: null, age_verified: false, age_verification_source: null });
    expect((await h.api("GET", `/chapters/${matureChapterId}`, alice.token)).json.details.code).toBe("AGE_VERIFICATION_REQUIRED");
  });

  it("returns 503 when the provider is not configured", async () => {
    Object.assign(env, { KYC_PROVIDER: "none" });
    expect((await start(dave)).status).toBe(503);
    expect((await h.api("GET", "/kyc/status", dave.token)).json).toMatchObject({ enabled: false, status: "none" });
    Object.assign(env, { KYC_PROVIDER: "didit" });
  });
});
