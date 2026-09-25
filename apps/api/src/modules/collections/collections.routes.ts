import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as collectionsController from "@/modules/collections/collections.controller";

/** เพิ่มภายหลัง (หน้า My Library) — ชั้นหนังสือย่อยของผู้ใช้ ทุก route เป็นของเจ้าของเท่านั้น */
const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(collectionsController.list));
router.post("/", asyncHandler(collectionsController.create));
router.patch("/:collection_id", asyncHandler(collectionsController.update));
router.delete("/:collection_id", asyncHandler(collectionsController.remove));
router.post("/:collection_id/items", asyncHandler(collectionsController.addItem));
router.delete("/:collection_id/items/:novel_id", asyncHandler(collectionsController.removeItem));

export default router;
