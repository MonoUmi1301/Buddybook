import type { Request, Response } from "express";
import { z } from "zod";
import * as recommendationsService from "@/modules/recommendations/recommendations.service";
import * as internalService from "@/modules/internal/internal.service";

export async function syncRecommendations(_req: Request, res: Response) {
  const result = await recommendationsService.fullResync();
  res.status(200).json({ synced: true, ...result });
}

export async function pendingQueue(_req: Request, res: Response) {
  const result = await internalService.getPendingQueue();
  res.status(200).json(result);
}

const sentimentCallbackBodySchema = z.object({
  target_type: z.enum(["comment", "review"]),
  target_id: z.string().uuid(),
  sentiment_label: z.enum(["pos", "neg", "neutral"]),
  sentiment_score: z.number().min(0).max(1),
});

export async function sentimentCallback(req: Request, res: Response) {
  const body = sentimentCallbackBodySchema.parse(req.body);
  const result = await internalService.submitSentimentCallback(body);
  res.status(200).json(result);
}

export async function purgeTrash(_req: Request, res: Response) {
  const result = await internalService.purgeExpiredTrash();
  res.status(200).json(result);
}

export async function publishScheduledChapters(_req: Request, res: Response) {
  const result = await internalService.publishScheduledChapters();
  res.status(200).json(result);
}
