import type { KycVerification } from "@prisma/client";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { saveVerifiedBirthDate } from "@/lib/contentRating";
import { KYC_CONSENT_VERSION } from "@/lib/kyc/consent";
import { evaluateKycReview, hashDocumentNumber, type KycRejectReason } from "@/lib/kyc/evaluate";
import {
  createDiditSession,
  deleteDiditSession,
  getDiditDecision,
  isDiditConfigured,
  toKycReview,
  verifyDiditWebhook,
  type DiditWebhookHeaders,
} from "@/lib/kyc/didit";

/**
 * e-KYC ยืนยันอายุด้วยบัตรประชาชน/พาสปอร์ต + Liveness ผ่าน Didit (ดู docs/age-verification-kyc.md)
 *
 *  1. POST /kyc/session — ผู้ใช้ยอมรับข้อความขอความยินยอม (บันทึกฉบับ + เวลา) → สร้าง session → ได้ url หน้า Didit
 *  2. เบราว์เซอร์ redirect ไปหน้า Didit ถ่ายบัตร + สแกนใบหน้า (ภาพไม่ผ่านเซิร์ฟเวอร์เรา) แล้ว Didit พากลับมา /verify-identity
 *  3. Didit แจ้งผลทาง webhook → ดึง decision (server-to-server) → evaluateKycReview
 *  4. ผ่าน: บันทึกวันเกิด (users.birth_date, source=kyc) + hash เลขเอกสาร; ข้อมูลอื่นทิ้งทันที
 *  5. ได้ผลสุดท้ายแล้วสั่งลบ session ฝั่ง Didit (ภาพ/วิดีโอ/ข้อมูลชีวภาพ) ทันที
 *  GET /kyc/status ดึงผลจาก Didit เองด้วยถ้ายังรออยู่ — webhook ยิงเข้า localhost ไม่ได้ตอนพัฒนา
 *  และเป็นทางสำรองถ้า webhook หาย
 */

const PROVIDER = "didit";
/** GET /kyc/status จะถามผู้ให้บริการซ้ำไม่ถี่กว่านี้ต่อรายการ (หน้าเว็บ poll ทุกไม่กี่วินาที) */
const STATUS_SYNC_INTERVAL_MS = 10_000;

function assertKycEnabled() {
  if (!isDiditConfigured()) throw ApiError.serviceUnavailable("ระบบยืนยันตัวตนด้วยบัตรยังไม่เปิดใช้งาน");
}

function latestVerification(user_id: string) {
  return prisma.kycVerification.findFirst({ where: { user_id }, orderBy: { created_at: "desc" } });
}

/** path ภายในเว็บเท่านั้น (กัน open redirect ผ่าน callback ของผู้ให้บริการ) */
function safeReturnPath(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/settings";
}

/** POST /kyc/session — ต้องส่ง consent_version ฉบับปัจจุบันมาเสมอ (เป็นหลักฐานว่าผู้ใช้ยินยอมก่อนเริ่มประมวลผล
 *  ข้อมูลชีวภาพ) ทำต่อจากรายการเดิมถ้ายังรออยู่ (Didit คืน session เดิมถ้ายังทำไม่เสร็จ) หรือเริ่มใหม่หลังไม่ผ่านแบบส่งใหม่ได้ */
export async function startKycSession(user_id: string, consent_version: string, return_to?: string) {
  assertKycEnabled();
  if (consent_version !== KYC_CONSENT_VERSION) {
    throw ApiError.badRequest("ข้อความขอความยินยอมมีการปรับปรุง กรุณารีเฟรชหน้าแล้วอ่านอีกครั้ง");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { user_id }, select: { age_verification_source: true } });
  if (user.age_verification_source === "kyc") throw ApiError.conflict("บัญชีนี้ยืนยันตัวตนด้วยบัตรแล้ว");

  const latest = await latestVerification(user_id);
  if (latest?.status === "rejected" && !latest.retry_allowed) {
    throw ApiError.conflict("ไม่สามารถยืนยันตัวตนซ้ำได้ กรุณาติดต่อฝ่ายสนับสนุน");
  }

  const consented_at = new Date();
  const row =
    latest && latest.status !== "approved" && latest.provider === PROVIDER
      ? await prisma.kycVerification.update({
          where: { verification_id: latest.verification_id },
          data: { status: "pending", reject_reason: null, consent_version, consented_at, updated_at: consented_at },
        })
      : await prisma.kycVerification.create({
          data: { user_id, provider: PROVIDER, consent_version, consented_at },
        });

  const callback = `${env.APP_URL}/verify-identity?return_to=${encodeURIComponent(safeReturnPath(return_to))}`;
  const session = await createDiditSession(row.external_ref, callback);
  await prisma.kycVerification.update({
    where: { verification_id: row.verification_id },
    data: { provider_session_id: session.sessionId, updated_at: new Date() },
  });
  return { url: session.url, provider: PROVIDER };
}

function toStatus(row: KycVerification | null) {
  return {
    enabled: isDiditConfigured(),
    status: row?.status ?? "none",
    reject_reason: row?.reject_reason ?? null,
    retry_allowed: row?.retry_allowed ?? true,
    document_type: row?.document_type ?? null,
    completed_at: row?.completed_at ?? null,
  };
}

/** GET /kyc/status */
export async function getKycStatus(user_id: string) {
  let row = await latestVerification(user_id);
  if (
    row?.status === "pending" &&
    row.provider_session_id &&
    isDiditConfigured() &&
    Date.now() - row.updated_at.getTime() >= STATUS_SYNC_INTERVAL_MS
  ) {
    await prisma.kycVerification.update({ where: { verification_id: row.verification_id }, data: { updated_at: new Date() } });
    try {
      row = (await syncFromProvider(row.provider_session_id)) ?? row;
    } catch (err) {
      // ผู้ให้บริการล่ม/ยังไม่มีผล — ตอบสถานะเดิมไป รอบหน้าค่อยลองใหม่
      if (!(err instanceof ApiError)) throw err;
    }
  }
  return toStatus(row);
}

/** ลบ session ฝั่ง Didit (ภาพ/วิดีโอ/face embedding) — best effort: ลบไม่สำเร็จให้ log แล้วพึ่ง data retention ของบัญชี */
export async function deleteProviderSessions(sessionIds: Array<string | null>) {
  for (const id of sessionIds) {
    if (!id) continue;
    try {
      await deleteDiditSession(id);
    } catch (err) {
      if (!(err instanceof ApiError && err.statusCode === 404)) {
        console.error("Didit session deletion failed — falls back to the account's data retention policy");
      }
    }
  }
}

async function reject(verification_id: string, reason: KycRejectReason, retry_allowed: boolean) {
  return prisma.kycVerification.update({
    where: { verification_id },
    data: { status: "rejected", reject_reason: reason, retry_allowed, completed_at: new Date(), updated_at: new Date() },
  });
}

/** ดึงผลล่าสุดจากผู้ให้บริการแล้วตัดสิน — เรียกจากทั้ง webhook และ status poll จึงต้อง idempotent:
 *  รายการที่ตัดสินไปแล้ว (approved / rejected) ไม่ถูกแก้ซ้ำ; ได้ผลสุดท้ายแล้วสั่งลบข้อมูลฝั่งผู้ให้บริการ */
export async function syncFromProvider(provider_session_id: string): Promise<KycVerification | null> {
  const row = await prisma.kycVerification.findUnique({ where: { provider_session_id } });
  if (!row || row.status !== "pending") return row;

  const evaluation = evaluateKycReview(toKycReview(await getDiditDecision(provider_session_id)));
  if (evaluation.outcome === "pending") return row;

  let result: KycVerification | null;
  if (evaluation.outcome === "rejected") {
    result = await reject(row.verification_id, evaluation.reason, evaluation.retryAllowed);
  } else {
    const id_number_hash = evaluation.documentNumber
      ? hashDocumentNumber(evaluation.documentCountry, evaluation.documentType, evaluation.documentNumber, env.KYC_ID_HASH_SECRET)
      : null;

    result = await prisma.$transaction(async (tx) => {
      // webhook กับ status poll อาจมาพร้อมกัน — ล็อกแถวแล้วเช็คสถานะซ้ำ
      const [locked] = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM kyc_verifications WHERE verification_id = ${row.verification_id}::uuid FOR UPDATE`;
      if (locked?.status !== "pending") return tx.kycVerification.findUnique({ where: { verification_id: row.verification_id } });

      if (id_number_hash) {
        // เอกสารใบเดียวใช้ยืนยันได้บัญชีเดียว — advisory lock กันสองบัญชีอนุมัติด้วยเลขเดียวกันพร้อมกัน
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id_number_hash}))`;
        const duplicate = await tx.kycVerification.findFirst({
          where: { id_number_hash, status: "approved", user_id: { not: row.user_id } },
          select: { verification_id: true },
        });
        if (duplicate) {
          return tx.kycVerification.update({
            where: { verification_id: row.verification_id },
            data: { status: "rejected", reject_reason: "DUPLICATE_IDENTITY", retry_allowed: false, completed_at: new Date(), updated_at: new Date() },
          });
        }
      }

      await saveVerifiedBirthDate(row.user_id, evaluation.birth, "kyc", tx);
      return tx.kycVerification.update({
        where: { verification_id: row.verification_id },
        data: {
          status: "approved",
          document_type: evaluation.documentType,
          document_country: evaluation.documentCountry,
          id_number_hash,
          reject_reason: null,
          completed_at: new Date(),
          updated_at: new Date(),
        },
      });
    });
  }

  // ผลสุดท้ายแล้ว — ไม่ต้องให้ผู้ให้บริการเก็บภาพบัตร/ใบหน้าต่อ (PDPA data minimization)
  await deleteProviderSessions([provider_session_id]);
  return result;
}

/** POST /webhooks/kyc/didit — ยืนยันลายเซ็น + ความสดของ timestamp ที่ถูกเซ็นก่อนเชื่อเนื้อหาใด ๆ
 *  ไม่เชื่อ decision ใน payload — ดึงจาก API ใหม่ทุกครั้ง; ส่งซ้ำ (event_id เดิม/retry) ไม่มีผลเพราะ syncFromProvider
 *  ตัดสินแต่ละรายการครั้งเดียว (ล็อกแถว + ข้ามรายการที่ไม่ใช่ pending)
 *  ตอบ 2xx เมื่อจัดการแล้วหรือไม่เกี่ยวกับเรา, throw (5xx) เมื่ออยากให้ผู้ให้บริการส่งซ้ำ */
export async function handleDiditWebhook(rawBody: Buffer, headers: DiditWebhookHeaders) {
  const payload = verifyDiditWebhook(rawBody, headers);
  if (!payload) throw ApiError.unauthorized("Invalid webhook signature");

  // ผลจาก sandbox ห้ามปลดล็อกอะไรบน production (ทดสอบด้วยเอกสารปลอมได้)
  if (env.NODE_ENV === "production" && payload.environment === "sandbox") return { handled: false };
  if (payload.webhook_type !== "status.updated" || !payload.session_id) return { handled: false };

  const row = await prisma.kycVerification.findUnique({ where: { provider_session_id: payload.session_id } });
  if (!row) return { handled: false };
  await syncFromProvider(payload.session_id);
  return { handled: true };
}

/** DELETE /kyc — ถอนความยินยอม/ขอลบข้อมูล (PDPA): ลบ session ฝั่ง Didit, ลบหลักฐาน e-KYC ทั้งหมดของเรา
 *  และยกเลิกอายุที่ได้จากบัตร */
export async function eraseKycData(user_id: string) {
  const rows = await prisma.kycVerification.findMany({ where: { user_id }, select: { provider_session_id: true } });
  await deleteProviderSessions(rows.map((r) => r.provider_session_id));
  await prisma.$transaction(async (tx) => {
    await tx.kycVerification.deleteMany({ where: { user_id } });
    await tx.user.updateMany({
      where: { user_id, age_verification_source: "kyc" },
      data: { birth_date: null, age_verified: false, age_verification_source: null, updated_at: new Date() },
    });
  });
}
