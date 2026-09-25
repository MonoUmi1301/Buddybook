import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as libraryController from "@/modules/library/library.controller";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(libraryController.list));
router.post("/", asyncHandler(libraryController.add));
// ต้องมาก่อน /:novel_id — ไม่งั้น "continue-reading" จะถูกจับเป็น novel_id
router.get("/continue-reading", asyncHandler(libraryController.continueReading));
router.patch("/:novel_id", asyncHandler(libraryController.updateStatus));
router.delete("/:novel_id", asyncHandler(libraryController.remove));

export default router;
