import { Router } from "express";
import { env } from "@/config/env";
import { attachUserIfPresent, requireAuth } from "@/middleware/auth.middleware";
import { rateLimitPerUser } from "@/middleware/rateLimit.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as giftsController from "@/modules/gifts/gifts.controller";

/** POST /gifts/send กับ POST /donations เดิมนับรวม bucket เดียวกัน (ดู donations.routes.ts) */
export const giftSendRateLimit = rateLimitPerUser({
  bucket: "gift-send",
  max: () => env.GIFT_SEND_RATE_LIMIT_PER_MIN,
  windowMs: 60_000,
});

// /gifts
const router = Router();
router.get("/catalog", asyncHandler(giftsController.catalog));
router.post("/send", requireAuth, giftSendRateLimit, asyncHandler(giftsController.send));
export default router;

// /authors — หน้าสาธารณะของนักเขียน
export const authorsGiftsRouter = Router();
authorsGiftsRouter.get("/:user_id/gifts/public", attachUserIfPresent, asyncHandler(giftsController.publicGifts));

// /me — ของขวัญของผู้ใช้ที่ล็อกอินอยู่
export const meGiftsRouter = Router();
meGiftsRouter.use(requireAuth);
meGiftsRouter.get("/gifts/received", asyncHandler(giftsController.received));
meGiftsRouter.get("/gifts/sent", asyncHandler(giftsController.sent));
meGiftsRouter.get("/gifts/stats", asyncHandler(giftsController.stats));
meGiftsRouter.post("/gifts/:donation_id/thank", asyncHandler(giftsController.thank));
meGiftsRouter.patch("/gifts/:donation_id", asyncHandler(giftsController.updateReceived));
