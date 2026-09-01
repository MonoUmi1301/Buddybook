import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as walletController from "@/modules/wallet/wallet.controller";

const router = Router();

router.use(requireAuth);

router.get("/transactions", asyncHandler(walletController.listTransactions));
// ส่วนขยายนอก API_Endpoints.md เดิม — เติมเงินจริงผ่าน SlipOK (ดู lib/slipok.ts)
router.post("/topup/verify-slip", asyncHandler(walletController.verifyTopupSlip));

export default router;
