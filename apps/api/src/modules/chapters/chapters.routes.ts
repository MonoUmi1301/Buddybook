import { Router } from "express";
import { attachUserIfPresent, requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import { rateLimitByKey } from "@/middleware/rateLimit.middleware";
import { env } from "@/config/env";
import * as chaptersController from "@/modules/chapters/chapters.controller";

const router = Router();

// Requirement ข้อ 5 — คนอ่านจริงไม่เปิดตอนเกิน ~2 ตอน/วินาทีต่อเนื่องทั้งนาที; เกินนี้คือบอทดูดเนื้อหา
const chapterReadLimit = rateLimitByKey({
  bucket: "chapter-read",
  max: () => env.CHAPTER_READ_RATE_LIMIT_PER_MIN,
  windowMs: 60_000,
  key: (req) => {
    if (req.user?.user_id) return `u:${req.user.user_id}`;
    const fwd = req.headers["x-forwarded-for"];
    return `ip:${((Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.ip) ?? "unknown"}`;
  },
  message: "เปิดอ่านถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
});

router.get("/:chapter_id", attachUserIfPresent, chapterReadLimit, asyncHandler(chaptersController.getById));
router.patch("/:chapter_id", requireAuth, asyncHandler(chaptersController.update));
router.delete("/:chapter_id", requireAuth, asyncHandler(chaptersController.remove));
// เพิ่มภายหลัง (ตอนติดเหรียญ) — ปลดล็อกตอนด้วย coin
router.post("/:chapter_id/purchase", requireAuth, asyncHandler(chaptersController.purchase));

// Auto-save ทุก 30 วินาที — เขียนลง chapter_versions (is_autosave=true)
router.patch("/:chapter_id/autosave", requireAuth, asyncHandler(chaptersController.autosave));
router.get("/:chapter_id/versions", requireAuth, asyncHandler(chaptersController.listVersions));
router.post(
  "/:chapter_id/versions/:version_id/restore",
  requireAuth,
  asyncHandler(chaptersController.restoreVersion)
);

router.get("/:chapter_id/comments", attachUserIfPresent, asyncHandler(chaptersController.listComments));
router.post("/:chapter_id/comments", requireAuth, asyncHandler(chaptersController.createComment));

export default router;
