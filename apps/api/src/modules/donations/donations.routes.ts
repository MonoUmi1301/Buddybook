import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as donationsController from "@/modules/donations/donations.controller";

const router = Router();

router.use(requireAuth);

router.post("/", asyncHandler(donationsController.create));

export default router;
