import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as walletController from "@/modules/wallet/wallet.controller";

const router = Router();

router.use(requireAuth);

router.get("/transactions", asyncHandler(walletController.listTransactions));
// ส่วนขยายนอก API_Endpoints.md เดิม — เติมเงินจริงผ่าน SlipOK (ดู lib/slipok.ts) เก็บไว้เผื่อใช้อีก
router.post("/topup/verify-slip", asyncHandler(walletController.verifyTopupSlip));
// เพิ่มภายหลัง (audit fix) — เติมเงินผ่าน Stripe Checkout (embedded) แทนการอัปโหลดสลิปเป็นทางหลัก
router.post("/topup/checkout-session", asyncHandler(walletController.createCheckoutSession));
router.get("/topup/checkout-session/:id/status", asyncHandler(walletController.getCheckoutSessionStatus));

export default router;
