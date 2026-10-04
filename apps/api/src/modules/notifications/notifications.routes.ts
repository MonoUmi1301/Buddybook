import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as notificationsController from "@/modules/notifications/notifications.controller";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(notificationsController.list));
// gap 3.3 — ต้องอยู่ก่อน "/:notification_id/*"
router.patch("/read-all", asyncHandler(notificationsController.markAllRead));
router.get("/preferences", asyncHandler(notificationsController.getPreferences));
router.put("/preferences", asyncHandler(notificationsController.setPreferences));
router.patch("/:notification_id/read", asyncHandler(notificationsController.markRead));

export default router;
