import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as trashBinController from "@/modules/trash-bin/trash-bin.controller";

const router = Router();

router.use(requireAuth);

// Soft Delete Trash Bin — 30 วัน retention (deleted_at + auto_delete_at)
router.post("/:trash_id/restore", asyncHandler(trashBinController.restore));
router.delete("/:trash_id", asyncHandler(trashBinController.remove));

export default router;
