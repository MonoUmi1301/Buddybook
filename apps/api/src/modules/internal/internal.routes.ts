import { Router } from "express";
import { requireInternalService } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as internalController from "@/modules/internal/internal.controller";

const router = Router();

router.use(requireInternalService);

// Python NLP Worker → poll หา comment/review ที่ยังไม่ได้วิเคราะห์ sentiment
router.get("/nlp/pending-queue", asyncHandler(internalController.pendingQueue));
// Python NLP Worker → ส่งผลลัพธ์กลับหลัง WangchanBERTa วิเคราะห์เสร็จ (async pattern)
router.post("/nlp/sentiment-callback", asyncHandler(internalController.sentimentCallback));

// Cron Scheduler — ลบ trash_bin ที่เกิน auto_delete_at ทุกวัน
router.post("/trash-bin/purge", asyncHandler(internalController.purgeTrash));

// Cron Scheduler — flip ตอนที่ตั้งเวลาเผยแพร่ไว้ (status=scheduled) เป็น published เมื่อถึงเวลา
router.post("/chapters/publish-scheduled", asyncHandler(internalController.publishScheduledChapters));

// Sync ข้อมูลเข้า Neo4j recommendation graph (full resync — ดู recommendations.service.ts)
router.post("/recommendations/sync", asyncHandler(internalController.syncRecommendations));

export default router;
