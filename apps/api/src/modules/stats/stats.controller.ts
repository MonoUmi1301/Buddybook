import type { Request, Response } from "express";
import { z } from "zod";
import * as statsService from "@/modules/stats/stats.service";

const novelParamSchema = z.object({ novel_id: z.string().uuid() });
const querySchema = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d)).default(30) });

export async function overview(req: Request, res: Response) {
  res.status(200).json(await statsService.getMyNovelsOverview(req.user!.user_id));
}

export async function novel(req: Request, res: Response) {
  const { novel_id } = novelParamSchema.parse(req.params);
  const { days } = querySchema.parse(req.query);
  res.status(200).json(await statsService.getNovelStats(novel_id, req.user!.user_id, days));
}
