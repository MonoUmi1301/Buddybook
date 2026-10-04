import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { rateLimitPerUser } from "@/middleware/rateLimit.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as supportController from "@/modules/support/support.controller";

// gap 3.2 — ระบบแจ้งปัญหา (คิวของทีมงานอยู่ที่ GET /admin/support/tickets)
const router = Router();
router.use(requireAuth);

// กันสแปมเปิดเรื่อง/ส่งข้อความรัว ๆ (ต่อผู้ใช้)
const createLimit = rateLimitPerUser({ bucket: "support-create", max: 5, windowMs: 60 * 60 * 1000 });
const messageLimit = rateLimitPerUser({ bucket: "support-message", max: 30, windowMs: 60 * 60 * 1000 });

router.post("/tickets", createLimit, asyncHandler(supportController.create));
router.get("/tickets", asyncHandler(supportController.listMine));
router.get("/tickets/:ticket_id", asyncHandler(supportController.get));
router.post("/tickets/:ticket_id/messages", messageLimit, asyncHandler(supportController.addMessage));
router.patch("/tickets/:ticket_id/status", asyncHandler(supportController.updateStatus));

export default router;
