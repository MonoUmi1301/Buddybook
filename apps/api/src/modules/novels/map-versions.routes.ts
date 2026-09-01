import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as novelsController from "@/modules/novels/novels.controller";

// เพิ่มภายหลัง (audit fix) — ประวัติเวอร์ชันแผนที่: กู้คืนจาก version ที่เลือก
// (สร้าง/ดูรายการ version ผูกกับ novel_id อยู่ที่ novels.routes.ts แล้ว — เส้นทางนี้แยกไว้เพราะ
// ตัว restore ระบุแค่ version_id ไม่ต้องมี novel_id ใน path เหมือน POST /trash-bin/:id/restore)
const router = Router();
router.use(requireAuth);
router.post("/:version_id/restore", asyncHandler(novelsController.restoreMapVersion));

export default router;
