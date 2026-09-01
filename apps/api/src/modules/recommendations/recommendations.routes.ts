import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as recommendationsController from "@/modules/recommendations/recommendations.controller";

const router = Router();

// อ่านจาก Neo4j graph (INTERESTED_IN / HAS_TAG / READ{sentiment_score})
// ดู recommendation_graph_import.cql ใน buddybook_real
router.get("/", requireAuth, asyncHandler(recommendationsController.get));

export default router;
