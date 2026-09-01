import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as locationsController from "@/modules/locations/locations.controller";

const router = Router();

router.use(requireAuth);

router.patch("/:location_id", asyncHandler(locationsController.update));
router.delete("/:location_id", asyncHandler(locationsController.remove));

export default router;

// location_edges — เส้นทาง/ถนนเชื่อมระหว่างสถานที่ (พอร์ตมาจาก buddybook_demo/tool_map)
export const locationEdgesRouter = Router();
locationEdgesRouter.use(requireAuth);
locationEdgesRouter.delete("/:edge_id", asyncHandler(locationsController.removeEdge));
