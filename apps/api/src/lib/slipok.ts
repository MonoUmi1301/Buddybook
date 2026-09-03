import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import { stringToUuid } from "@/lib/idHash";

/** ฟีเจอร์เติมเงินด้วยสลิปทั้งหมด gate ตัวเองด้วยอันนี้ (เช่นเดียวกับ Cloudinary) —
 *  ผู้ใช้ยังไม่ได้สมัคร SlipOK ตอนที่เขียนโค้ดนี้ (สมัครได้ที่ slipok.com) */
export function isSlipOkConfigured(): boolean {
  return Boolean(env.SLIPOK_API_KEY && env.SLIPOK_BRANCH_ID);
}

interface SlipOkVerifyResult {
  amount: number;
  transRef: string;
  receivingBankAccount: string;
}

/**
 * เรียก SlipOK API จริง (https://slipok.com) — ต่างจากการทำ OCR อ่านตัวเลขจากรูปสลิปเฉย ๆ
 * SlipOK จะ decode ข้อมูล QR/ใบสลิปแล้ว cross-check กับธนาคารผู้ออกสลิปแบบ real-time ว่ารายการ
 * โอนนี้เกิดขึ้นจริง จำนวนเท่าไหร่ โอนไปบัญชีไหน — ไม่ใช่แค่เชื่อรูปที่ผู้ใช้อัปโหลดมาเฉย ๆ
 * (ตอบคำถามผู้ใช้ตอนคุยเรื่อง flow: นี่คือส่วนที่ป้องกันการปลอมสลิป/ใช้สลิปเก่าซ้ำ)
 */
export async function verifySlip(imageUrl: string): Promise<SlipOkVerifyResult> {
  if (!isSlipOkConfigured()) {
    throw ApiError.badRequest(
      "SlipOK is not configured — set SLIPOK_API_KEY/SLIPOK_BRANCH_ID in apps/api/.env (สมัครได้ที่ slipok.com)"
    );
  }

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw ApiError.badRequest("Could not download slip image");
  const imageBlob = await imageRes.blob();

  const form = new FormData();
  form.append("files", imageBlob, "slip.jpg");

  let slipOkRes: Response;
  try {
    slipOkRes = await fetch(`https://api.slipok.com/api/line/apikey/${env.SLIPOK_BRANCH_ID}`, {
      method: "POST",
      headers: { "x-authorization": env.SLIPOK_API_KEY },
      body: form,
    });
  } catch {
    throw ApiError.badRequest("Could not reach SlipOK — ตรวจสอบการเชื่อมต่อเครือข่าย");
  }

  const json = (await slipOkRes.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: { amount?: number; transRef?: string; receiver?: { account?: string } };
  } | null;

  if (!slipOkRes.ok || !json?.success || !json.data) {
    throw ApiError.unprocessable(json?.message ?? "Slip verification failed", json);
  }

  return {
    amount: Number(json.data.amount ?? 0),
    transRef: json.data.transRef ?? "",
    receivingBankAccount: json.data.receiver?.account ?? "",
  };
}

/** เดิมเป็นฟังก์ชันในไฟล์นี้ ย้ายไป lib/idHash.ts แล้ว (ตอนเพิ่ม Stripe เข้ามา ใช้ hash แบบเดียวกัน
 *  กับ session id ของ Stripe ด้วย ไม่ใช่แค่ transRef ของ SlipOK) — export ชื่อเดิมไว้กันของเก่าพัง */
export const transRefToUuid = stringToUuid;
