import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { rateLimitPerUser } from "@/middleware/rateLimit.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as presenceController from "@/modules/presence/presence.controller";

const router = Router();

// ผู้อ่านออนไลน์ (lib/presence.ts) — ปกติ 1 ครั้ง/นาที เผื่อเปิดหลายแท็บ/สลับแท็บไปมา
router.post(
  "/heartbeat",
  requireAuth,
  rateLimitPerUser({ bucket: "presence", max: 20, windowMs: 60_000 }),
  asyncHandler(presenceController.heartbeat)
);

export default router;
