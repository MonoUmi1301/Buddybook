import { Router } from "express";
import { requireAuth, requireAdmin } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as adminController from "@/modules/admin/admin.controller";

// GET /admin/tags เป็น (Public) ตาม API_Endpoints.md — แยก router นี้ไว้ mount
// ก่อน adminRoutes ใน routes/index.ts เพื่อไม่ให้โดน requireAuth/requireAdmin บังคับ
export const publicAdminRouter = Router();
publicAdminRouter.get("/tags", asyncHandler(adminController.listTags));

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/novels/pending", asyncHandler(adminController.pendingNovels));
router.patch("/novels/:novel_id/approve", asyncHandler(adminController.approveNovel));
router.patch("/novels/:novel_id/reject", asyncHandler(adminController.rejectNovel));

router.get("/users", asyncHandler(adminController.listUsers));
router.patch("/users/:user_id/role", asyncHandler(adminController.updateUserRole));
router.patch("/users/:user_id/suspend", asyncHandler(adminController.suspendUser));

router.post("/tags", asyncHandler(adminController.createTag));
router.patch("/tags/:tag_id", asyncHandler(adminController.updateTag));
router.delete("/tags/:tag_id", asyncHandler(adminController.deleteTag));

router.get("/reports/stats", asyncHandler(adminController.stats));

export default router;
