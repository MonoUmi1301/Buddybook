import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as notificationsController from "@/modules/notifications/notifications.controller";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(notificationsController.list));
router.patch("/:notification_id/read", asyncHandler(notificationsController.markRead));

export default router;
