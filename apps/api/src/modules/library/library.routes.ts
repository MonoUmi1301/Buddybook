import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as libraryController from "@/modules/library/library.controller";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(libraryController.list));
router.post("/", asyncHandler(libraryController.add));
router.delete("/:novel_id", asyncHandler(libraryController.remove));

export default router;
