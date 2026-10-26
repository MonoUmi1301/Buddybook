import type { Request, Response } from "express";
import { z } from "zod";
import * as kycService from "@/modules/kyc/kyc.service";

const startSessionBodySchema = z.object({
  // ต้องกดยอมรับจริง (true) — ไม่ใช่แค่ส่ง field มา
  consent: z.literal(true),
  consent_version: z.string().min(1).max(20),
  // หน้าที่จะพากลับหลังยืนยันเสร็จ (path ภายในเว็บ — service ตรวจซ้ำ)
  return_to: z.string().max(300).optional(),
});

/** POST /kyc/session */
export async function startSession(req: Request, res: Response) {
  const { consent_version, return_to } = startSessionBodySchema.parse(req.body);
  res.status(200).json(await kycService.startKycSession(req.user!.user_id, consent_version, return_to));
}

/** GET /kyc/status */
export async function status(req: Request, res: Response) {
  res.status(200).json(await kycService.getKycStatus(req.user!.user_id));
}

/** DELETE /kyc */
export async function erase(req: Request, res: Response) {
  await kycService.eraseKycData(req.user!.user_id);
  res.status(204).send();
}

/** POST /webhooks/kyc/didit — mount ด้วย express.raw ใน app.ts (ต้องใช้ raw body คำนวณลายเซ็น) */
export async function diditWebhook(req: Request, res: Response) {
  const result = await kycService.handleDiditWebhook(req.body as Buffer, {
    signatureV2: req.header("x-signature-v2"),
    signatureV2Previous: req.header("x-signature-v2-previous"),
    signature: req.header("x-signature"),
    signaturePrevious: req.header("x-signature-previous"),
  });
  res.status(200).json(result);
}
