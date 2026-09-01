import { Router } from "express";
import { attachUserIfPresent, requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as chaptersController from "@/modules/chapters/chapters.controller";

const router = Router();

router.get("/:chapter_id", attachUserIfPresent, asyncHandler(chaptersController.getById));
router.patch("/:chapter_id", requireAuth, asyncHandler(chaptersController.update));
router.delete("/:chapter_id", requireAuth, asyncHandler(chaptersController.remove));

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
