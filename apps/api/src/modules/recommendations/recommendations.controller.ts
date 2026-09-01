import type { Request, Response } from "express";
import * as recommendationsService from "@/modules/recommendations/recommendations.service";

export async function get(req: Request, res: Response) {
  const result = await recommendationsService.getRecommendations(req.user!.user_id);
  res.status(200).json(result);
}
