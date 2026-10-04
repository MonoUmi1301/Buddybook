import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as statsController from "@/modules/stats/stats.controller";

// gap 3.1 / 3.5 — สถิตินักเขียน + social listening ภายในแพลตฟอร์ม (เจ้าของนิยายเท่านั้น)
const router = Router();

router.get("/stats/novels", requireAuth, asyncHandler(statsController.overview));
router.get("/stats/novels/:novel_id", requireAuth, asyncHandler(statsController.novel));

export default router;
