import { Router } from "express";
import { requireAuth, requireAdmin } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as adminController from "@/modules/admin/admin.controller";
import * as giftsController from "@/modules/gifts/gifts.controller";
import * as reportsController from "@/modules/reports/reports.controller";
import * as walletController from "@/modules/wallet/wallet.controller";

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
router.patch("/users/:user_id/unsuspend", asyncHandler(adminController.unsuspendUser));

// เพิ่มภายหลัง (รายงานเนื้อหา) — แยกชื่อจาก /reports/stats (สถิติ dashboard) ที่มีอยู่เดิม
router.get("/content-reports", asyncHandler(reportsController.adminListReports));
router.patch("/content-reports/:report_id", asyncHandler(reportsController.adminResolveReport));

// เพิ่มภายหลัง (ถอนรายได้นักเขียน)
router.get("/withdrawals", asyncHandler(walletController.adminListWithdrawals));
router.patch("/withdrawals/:withdrawal_id", asyncHandler(walletController.adminProcessWithdrawal));

router.post("/tags", asyncHandler(adminController.createTag));
router.patch("/tags/:tag_id", asyncHandler(adminController.updateTag));
router.delete("/tags/:tag_id", asyncHandler(adminController.deleteTag));

router.get("/reports/stats", asyncHandler(adminController.stats));

// เพิ่มภายหลัง (Gift donations) — แคตตาล็อกของขวัญ + การ์ดที่นักเขียนรายงาน
router.get("/gifts", asyncHandler(giftsController.adminList));
router.post("/gifts", asyncHandler(giftsController.adminCreate));
router.patch("/gifts/:gift_id", asyncHandler(giftsController.adminUpdate));
router.delete("/gifts/:gift_id", asyncHandler(giftsController.adminDelete));
router.get("/gift-reports", asyncHandler(giftsController.adminReports));
router.patch("/gift-reports/:donation_id", asyncHandler(giftsController.adminResolveReport));

export default router;
