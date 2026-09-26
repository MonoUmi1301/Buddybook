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
// สถานะคำสั่งเติม coin จาก DB — webhook เป็นคนเปลี่ยนสถานะ ฝั่ง client แค่อ่าน
router.get("/topup/orders/:order_id/status", asyncHandler(walletController.getTopupOrderStatus));
// เพิ่มภายหลัง (ถอนรายได้นักเขียน)
router.get("/withdrawals", asyncHandler(walletController.listWithdrawals));
router.post("/withdrawals", asyncHandler(walletController.createWithdrawal));

export default router;
