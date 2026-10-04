import type { Request, Response } from "express";
import { z } from "zod";
import * as recommendationsService from "@/modules/recommendations/recommendations.service";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(recommendationsService.DEFAULT_RECOMMENDATION_LIMIT),
});

export async function get(req: Request, res: Response) {
  const { limit } = querySchema.parse(req.query);
  const result = await recommendationsService.getRecommendations(req.user!.user_id, limit);
  res.status(200).json(result);
}
