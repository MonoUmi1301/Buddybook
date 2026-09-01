import type { Request, Response } from "express";
import { z } from "zod";
import * as trashBinService from "@/modules/trash-bin/trash-bin.service";

const trashIdParamSchema = z.object({ trash_id: z.string().uuid() });

export async function restore(req: Request, res: Response) {
  const { trash_id } = trashIdParamSchema.parse(req.params);
  const result = await trashBinService.restoreTrashItem(trash_id, req.user!.user_id);
  res.status(200).json(result);
}

export async function remove(req: Request, res: Response) {
  const { trash_id } = trashIdParamSchema.parse(req.params);
  await trashBinService.deleteTrashItemPermanently(trash_id, req.user!.user_id);
  res.status(204).send();
}
