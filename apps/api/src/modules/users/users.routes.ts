import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as usersController from "@/modules/users/users.controller";
import * as giftsController from "@/modules/gifts/gifts.controller";

const router = Router();

// /me/* ต้อง register ก่อน GET /:user_id เสมอ — ไม่งั้น Express จะจับ "me" เป็นค่า :user_id
// (เดิม router.use(requireAuth) ล็อกทั้ง router ตั้งแต่บรรทัดแรก แต่ /:user_id ต้องเป็น public
// จึงย้ายมาใส่ requireAuth เฉพาะ route /me/* แทน)
router.get("/me", requireAuth, asyncHandler(usersController.getMe));
router.patch("/me", requireAuth, asyncHandler(usersController.updateMe));
router.delete("/me", requireAuth, asyncHandler(usersController.deleteMe));
router.patch("/me/age-verification", requireAuth, asyncHandler(usersController.setAgeVerification));
router.post("/me/interests", requireAuth, asyncHandler(usersController.setInterests));

// Public — หน้าโปรไฟล์สาธารณะ (ส่วนขยายนอก API_Endpoints.md เดิม)
router.get("/:user_id", asyncHandler(usersController.getPublicProfile));
// เพิ่มภายหลัง (Gift donations) — ป้ายผู้สนับสนุน (เกณฑ์ใน config/supporterBadges.ts)
router.get("/:user_id/supporter-badges", asyncHandler(giftsController.supporterBadges));

export default router;
