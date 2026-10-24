import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { rateLimitPerUser } from "@/middleware/rateLimit.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as kycController from "@/modules/kyc/kyc.controller";

const router = Router();

// สร้าง session ที่ผู้ให้บริการ (กินโควตา/ค่าใช้จ่ายเมื่อผู้ใช้ทำจนจบ) — จำกัดไว้กันสคริปต์ยิงสร้างรัว ๆ
const sessionLimit = rateLimitPerUser({ bucket: "kyc-session", max: 20, windowMs: 60 * 60 * 1000 });

router.post("/session", requireAuth, sessionLimit, asyncHandler(kycController.startSession));
router.get("/status", requireAuth, asyncHandler(kycController.status));
router.delete("/", requireAuth, asyncHandler(kycController.erase));

export default router;
