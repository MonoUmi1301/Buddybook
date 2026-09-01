import { Router } from "express";
import { attachUserIfPresent, requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as novelsController from "@/modules/novels/novels.controller";

const router = Router();

// --- Implemented (public — personalized เมื่อแนบ Bearer token ที่ valid) ---
router.get("/search", attachUserIfPresent, asyncHandler(novelsController.search));
router.get("/:novel_id", attachUserIfPresent, asyncHandler(novelsController.getById));
router.get("/:novel_id/chapters", attachUserIfPresent, asyncHandler(novelsController.listChapters));

// ส่วนขยายนอก API_Endpoints.md เดิม — เพิ่มภายหลัง audit pass หลัง Phase 9 (ดู schema.prisma NovelLike)
router.post("/:novel_id/like", requireAuth, asyncHandler(novelsController.like));
router.delete("/:novel_id/like", requireAuth, asyncHandler(novelsController.unlike));

// --- Writer Workspace (ต้อง requireAuth + ตรวจ author_id ว่าเป็นเจ้าของ) ---
router.post("/", requireAuth, asyncHandler(novelsController.create));
router.patch("/:novel_id", requireAuth, asyncHandler(novelsController.update));
router.delete("/:novel_id", requireAuth, asyncHandler(novelsController.remove));

router.post("/:novel_id/chapters", requireAuth, asyncHandler(novelsController.createChapterForNovel));

router.get("/:novel_id/reviews", attachUserIfPresent, asyncHandler(novelsController.listReviews));
router.post("/:novel_id/reviews", requireAuth, asyncHandler(novelsController.createReview));

// ส่วนขยายนอก API_Endpoints.md เดิม — leaderboard ผู้สนับสนุน (ต้องมีคู่กับ POST /donations)
router.get("/:novel_id/donations", attachUserIfPresent, asyncHandler(novelsController.listDonors));

router.get("/:novel_id/trash-bin", requireAuth, asyncHandler(novelsController.listTrashBin));
router.get("/:novel_id/print-preview", requireAuth, asyncHandler(novelsController.printPreview));
router.get("/:novel_id/world-building", requireAuth, asyncHandler(novelsController.worldBuilding));
router.patch("/:novel_id/plot-notes", requireAuth, asyncHandler(novelsController.updatePlotNotes));
router.patch("/:novel_id/theme-notes", requireAuth, asyncHandler(novelsController.updateThemeNotes));
router.patch("/:novel_id/map-drawings", requireAuth, asyncHandler(novelsController.updateMapDrawings));
router.post("/:novel_id/map-versions", requireAuth, asyncHandler(novelsController.createMapVersion));
router.get("/:novel_id/map-versions", requireAuth, asyncHandler(novelsController.listMapVersions));

router.post("/:novel_id/characters", requireAuth, asyncHandler(novelsController.createCharacterForNovel));
router.post(
  "/:novel_id/character-edges",
  requireAuth,
  asyncHandler(novelsController.createCharacterEdgeForNovel)
);
router.post("/:novel_id/locations", requireAuth, asyncHandler(novelsController.createLocationForNovel));
router.post("/:novel_id/location-edges", requireAuth, asyncHandler(novelsController.createLocationEdgeForNovel));
router.post(
  "/:novel_id/timeline-events",
  requireAuth,
  asyncHandler(novelsController.createTimelineEventForNovel)
);

export default router;
