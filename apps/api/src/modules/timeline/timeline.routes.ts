import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as timelineController from "@/modules/timeline/timeline.controller";

const router = Router();

router.use(requireAuth);

router.patch("/:event_id", asyncHandler(timelineController.update));
router.delete("/:event_id", asyncHandler(timelineController.remove));

export default router;
