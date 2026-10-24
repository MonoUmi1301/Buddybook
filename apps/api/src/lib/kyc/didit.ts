import crypto from "node:crypto";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import type { KycReview } from "@/lib/kyc/evaluate";

/**
 * Didit client (e-KYC: บัตรประชาชน/พาสปอร์ต OCR + Liveness + Face match) — คุยแบบ server-to-server เท่านั้น
 * ผู้ใช้ถ่ายบัตร/สแกนหน้าบนหน้า hosted ของ Didit (redirect ไป `url` ของ session) ภาพไม่ผ่านเซิร์ฟเวอร์เรา
 * ผลแจ้งทาง webhook (HMAC) แล้วเราดึง decision จาก API เอง และสั่งลบ session ฝั่ง Didit ทันทีเมื่อได้ผลสุดท้าย
 * อ้างอิง: docs.didit.me — Sessions API (create / decision / delete), Webhooks, API authentication
 */

const REQUEST_TIMEOUT_MS = 10_000;
/** `timestamp` (ใน body ที่ถูกเซ็น) ต้องห่างเวลาปัจจุบันไม่เกินนี้ (ตามคู่มือ Didit) */
const WEBHOOK_TOLERANCE_SEC = 300;

export function isDiditConfigured(): boolean {
  // DIDIT_WEBHOOK_SECRET ไม่จำเป็นต่อการเปิดใช้ (dev ใช้ polling) — ไม่มี secret แล้ว verifyDiditWebhook ปฏิเสธทุก webhook
  return env.KYC_PROVIDER === "didit" && Boolean(env.DIDIT_API_KEY && env.DIDIT_WORKFLOW_ID);
}

async function diditRequest<T>(method: "GET" | "POST" | "DELETE", path: string, payload?: unknown): Promise<T> {
  if (!isDiditConfigured()) throw ApiError.serviceUnavailable("ระบบยืนยันตัวตนด้วยบัตรยังไม่เปิดใช้งาน");
  let res: Response;
  try {
    res = await fetch(`${env.DIDIT_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "x-api-key": env.DIDIT_API_KEY,
        ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw ApiError.serviceUnavailable("เชื่อมต่อผู้ให้บริการยืนยันตัวตนไม่ได้ กรุณาลองใหม่อีกครั้ง");
  }

  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !json) {
    // log แค่ status — ไม่ log body (decision มีข้อมูลส่วนบุคคล)
    console.error(`Didit ${method} ${path.replace(/[0-9a-f-]{36}/gi, ":id")} failed: ${res.status}`);
    throw res.status === 404
      ? ApiError.notFound("ไม่พบข้อมูลการยืนยันตัวตน")
      : ApiError.serviceUnavailable("ผู้ให้บริการยืนยันตัวตนตอบกลับผิดพลาด กรุณาลองใหม่อีกครั้ง");
  }
  return json;
}

/** สร้าง session — vendor_data = external_ref ของเรา (ไม่ใช่ user_id) และ callback = หน้าที่ Didit พากลับหลังทำเสร็จ
 *  Didit คืน session เดิมถ้ายังมีที่ทำไม่เสร็จของ vendor_data เดียวกัน (idempotent) */
export async function createDiditSession(externalRef: string, callbackUrl: string) {
  const res = await diditRequest<{ session_id: string; url: string }>("POST", "/v3/session/", {
    workflow_id: env.DIDIT_WORKFLOW_ID,
    vendor_data: externalRef,
    callback: callbackUrl,
    language: "th",
  });
  return { sessionId: res.session_id, url: res.url };
}

/** เฉพาะ field ที่ใช้ — ชื่อ ที่อยู่ ศาสนา ฯลฯ ใน decision ไม่ถูกอ่านหรือเก็บ */
export interface DiditDecision {
  session_id: string;
  status: string;
  vendor_data?: string | null;
  id_verifications?: Array<{
    status?: string;
    document_type?: string | null;
    issuing_state?: string | null;
    document_number?: string | null;
    personal_number?: string | null;
    date_of_birth?: string | null;
    expiration_date?: string | null;
  }> | null;
  liveness_checks?: Array<{ status?: string }> | null;
  face_matches?: Array<{ status?: string }> | null;
}

export function getDiditDecision(sessionId: string): Promise<DiditDecision> {
  return diditRequest<DiditDecision>("GET", `/v3/session/${encodeURIComponent(sessionId)}/decision/`);
}

/** ลบ session ฝั่ง Didit ถาวร (ภาพเอกสาร วิดีโอ เซลฟี และ face embedding) — ต้องให้ API key มีสิทธิ์ delete:sessions */
export async function deleteDiditSession(sessionId: string): Promise<void> {
  await diditRequest<unknown>("DELETE", `/v3/session/${encodeURIComponent(sessionId)}/delete/`);
}

const DOCUMENT_TYPES: Record<string, "ID_CARD" | "PASSPORT"> = {
  "Identity Card": "ID_CARD",
  Passport: "PASSPORT",
};

/** session status ของ Didit → สถานะกลางที่ evaluateKycReview ใช้ */
export function toKycReview(decision: DiditDecision): KycReview {
  switch (decision.status) {
    case "Approved":
      break;
    case "Declined":
      return { state: "declined", retryAllowed: true };
    case "Expired":
    case "Abandoned":
    case "Kyc Expired":
      return { state: "expired" };
    default:
      // Not Started / In Progress / Awaiting User / In Review / Resubmitted
      return { state: "pending" };
  }
  const allApproved = (items?: Array<{ status?: string }> | null) =>
    Boolean(items?.length) && items!.every((i) => i.status === "Approved");
  return {
    state: "approved",
    livenessPassed: allApproved(decision.liveness_checks),
    faceMatchPassed: allApproved(decision.face_matches),
    documents: (decision.id_verifications ?? []).map((doc) => ({
      type: DOCUMENT_TYPES[doc.document_type ?? ""] ?? null,
      country: doc.issuing_state ?? null,
      numbers: [doc.personal_number, doc.document_number].filter((n): n is string => Boolean(n)),
      birthDate: doc.date_of_birth ?? null,
      validUntil: doc.expiration_date ?? null,
    })),
  };
}

export interface DiditWebhookPayload {
  event_id?: string;
  session_id?: string;
  status?: string;
  webhook_type?: string;
  vendor_data?: string | null;
  environment?: string;
  /** เวลาส่ง (epoch วินาที) — อยู่ใน body ที่ถูกเซ็น ใช้ตรวจความสดแทน header X-Timestamp ที่ไม่ได้ถูกเซ็น */
  timestamp?: number;
}

export interface DiditWebhookHeaders {
  signatureV2?: string;
  signatureV2Previous?: string;
  signature?: string;
  signaturePrevious?: string;
}

/** canonical JSON ของ X-Signature-V2 ตามคู่มือ Didit: shortenFloats → sortKeys (array คงลำดับ) → JSON.stringify
 *  (Unicode ไม่ escape — ค่าปริยายของ JS) — ทนต่อ middleware ที่ parse/serialize body ใหม่ */
function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)]));
  }
  if (typeof v === "number" && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

export function canonicalWebhookBody(parsed: unknown): string {
  return JSON.stringify(sortKeys(shortenFloats(parsed)));
}

function hmacMatches(expectedHex: string, given: string | undefined) {
  if (!given) return false;
  const a = Buffer.from(expectedHex, "utf8");
  const b = Buffer.from(given.toLowerCase(), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * ยืนยัน webhook (ตามคู่มือ Didit):
 *  1. X-Signature-V2 = HMAC-SHA256 ของ canonical JSON (แนะนำ) — หรือ X-Signature = HMAC ของ raw body ตรง ๆ
 *     รับ *-Previous ด้วย (Didit ส่งให้ 24 ชม. หลังหมุน secret) เทียบแบบ constant-time
 *  2. ความสดดูจาก `timestamp` ใน body (ถูกเซ็นแล้ว) ห่างไม่เกิน 5 นาที — ไม่ใช้ header X-Timestamp
 *     เพราะไม่อยู่ในลายเซ็น ผู้โจมตีเอา body+ลายเซ็นเก่ามายิงซ้ำพร้อม header ใหม่ได้
 * คืน payload ที่ parse แล้วเมื่อผ่าน, null เมื่อไม่ผ่าน
 */
export function verifyDiditWebhook(
  rawBody: Buffer,
  headers: DiditWebhookHeaders,
  secret = env.DIDIT_WEBHOOK_SECRET,
  nowSec = Math.floor(Date.now() / 1000)
): DiditWebhookPayload | null {
  if (!secret) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const hmac = (data: string | Buffer) => crypto.createHmac("sha256", secret).update(data).digest("hex");
  const v2 = hmac(canonicalWebhookBody(parsed));
  const raw = hmac(rawBody);
  const signed =
    hmacMatches(v2, headers.signatureV2) ||
    hmacMatches(v2, headers.signatureV2Previous) ||
    hmacMatches(raw, headers.signature) ||
    hmacMatches(raw, headers.signaturePrevious);
  if (!signed) return null;

  const payload = parsed as DiditWebhookPayload;
  const ts = Number(payload.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > WEBHOOK_TOLERANCE_SEC) return null;
  return payload;
}
