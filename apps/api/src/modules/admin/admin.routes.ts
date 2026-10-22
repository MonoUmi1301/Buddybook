import { Router } from "express";
import { requireAuth, requireAdmin } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as adminController from "@/modules/admin/admin.controller";
import * as giftsController from "@/modules/gifts/gifts.controller";
import * as reportsController from "@/modules/reports/reports.controller";
import * as walletController from "@/modules/wallet/wallet.controller";
import * as supportController from "@/modules/support/support.controller";

// GET /admin/tags เป็น (Public) ตาม API_Endpoints.md — แยก router นี้ไว้ mount
// ก่อน adminRoutes ใน routes/index.ts เพื่อไม่ให้โดน requireAuth/requireAdmin บังคับ
export const publicAdminRouter = Router();
publicAdminRouter.get("/tags", asyncHandler(adminController.listTags));

const router = Router();

router.use(requireAuth, requireAdmin);

// post-moderation — นิยายเผยแพร่ทันที แอดมินตรวจทีหลัง (แทนคิว pending/approve/reject เดิม)
router.get("/novels/moderation", asyncHandler(adminController.moderationQueue));
router.patch("/novels/:novel_id/suspend", asyncHandler(adminController.suspendNovel));
router.patch("/novels/:novel_id/reviewed", asyncHandler(adminController.markNovelReviewed));
router.patch("/novels/:novel_id/moderation", asyncHandler(adminController.resolveModeration));

router.get("/users", asyncHandler(adminController.listUsers));
router.patch("/users/:user_id/role", asyncHandler(adminController.updateUserRole));
router.patch("/users/:user_id/suspend", asyncHandler(adminController.suspendUser));
router.patch("/users/:user_id/unsuspend", asyncHandler(adminController.unsuspendUser));

// เพิ่มภายหลัง (รายงานเนื้อหา) — แยกชื่อจาก /reports/stats (สถิติ dashboard) ที่มีอยู่เดิม
router.get("/content-reports", asyncHandler(reportsController.adminListReports));
router.patch("/content-reports/:report_id", asyncHandler(reportsController.adminResolveReport));

// gap 3.2 — คิวเรื่องแจ้งปัญหา (ตอบ/เปลี่ยนสถานะใช้ /support/tickets/:id/* เดียวกับผู้ใช้ ระบบรู้จาก role)
router.get("/support/tickets", asyncHandler(supportController.adminList));

// เพิ่มภายหลัง (ถอนรายได้นักเขียน)
router.get("/withdrawals", asyncHandler(walletController.adminListWithdrawals));
router.patch("/withdrawals/:withdrawal_id", asyncHandler(walletController.adminProcessWithdrawal));

router.post("/tags", asyncHandler(adminController.createTag));
router.patch("/tags/:tag_id", asyncHandler(adminController.updateTag));
router.delete("/tags/:tag_id", asyncHandler(adminController.deleteTag));

router.get("/reports/stats", asyncHandler(adminController.stats));
router.get("/reports/activity", asyncHandler(adminController.recentActivity));
router.get("/dashboard", asyncHandler(adminController.dashboard));
router.get("/recommendations/resync", asyncHandler(adminController.resyncRecommendationsStatus));
router.post("/recommendations/resync", asyncHandler(adminController.resyncRecommendations));
router.get("/reports/sentiment", asyncHandler(adminController.sentimentOverview));

// เพิ่มภายหลัง (Gift donations) — แคตตาล็อกของขวัญ + การ์ดที่นักเขียนรายงาน
router.get("/gifts", asyncHandler(giftsController.adminList));
router.post("/gifts", asyncHandler(giftsController.adminCreate));
router.patch("/gifts/:gift_id", asyncHandler(giftsController.adminUpdate));
router.delete("/gifts/:gift_id", asyncHandler(giftsController.adminDelete));
router.get("/gift-reports", asyncHandler(giftsController.adminReports));
router.patch("/gift-reports/:donation_id", asyncHandler(giftsController.adminResolveReport));

export default router;
