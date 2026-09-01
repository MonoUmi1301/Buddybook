import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as uploadsController from "@/modules/uploads/uploads.controller";

const router = Router();

router.use(requireAuth);

router.post("/sign", asyncHandler(uploadsController.sign));

export default router;
