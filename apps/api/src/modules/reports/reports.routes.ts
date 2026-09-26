import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { rateLimitPerUser } from "@/middleware/rateLimit.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as reportsController from "@/modules/reports/reports.controller";

const router = Router();

// เพิ่มภายหลัง (รายงานเนื้อหา) — จำกัด 20 รายงาน/ชั่วโมงต่อผู้ใช้ กันสแปมคิวแอดมิน
router.post(
  "/",
  requireAuth,
  rateLimitPerUser({ bucket: "content-report", max: 20, windowMs: 60 * 60 * 1000 }),
  asyncHandler(reportsController.createReport)
);

export default router;
