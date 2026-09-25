import type { Request, Response } from "express";
import { z } from "zod";
import * as collectionsService from "@/modules/collections/collections.service";

const tintSchema = z.enum(collectionsService.COLLECTION_TINTS);
const idParams = z.object({ collection_id: z.string().uuid() });
const itemParams = idParams.extend({ novel_id: z.string().uuid() });

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.enum(collectionsService.COLLECTION_ICONS).nullable().optional(),
  tint: tintSchema.optional(),
});

const updateBodySchema = createBodySchema
  .partial()
  .extend({ position: z.number().int().min(0).optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export async function list(req: Request, res: Response) {
  res.status(200).json(await collectionsService.listCollections(req.user!.user_id));
}

export async function create(req: Request, res: Response) {
  const body = createBodySchema.parse(req.body);
  res.status(201).json(await collectionsService.createCollection(req.user!.user_id, body));
}

export async function update(req: Request, res: Response) {
  const { collection_id } = idParams.parse(req.params);
  const body = updateBodySchema.parse(req.body);
  res.status(200).json(await collectionsService.updateCollection(collection_id, req.user!.user_id, body));
}

export async function remove(req: Request, res: Response) {
  const { collection_id } = idParams.parse(req.params);
  await collectionsService.deleteCollection(collection_id, req.user!.user_id);
  res.status(204).send();
}

export async function addItem(req: Request, res: Response) {
  const { collection_id } = idParams.parse(req.params);
  const { novel_id } = z.object({ novel_id: z.string().uuid() }).parse(req.body);
  res.status(201).json(await collectionsService.addItem(collection_id, req.user!.user_id, novel_id));
}

export async function removeItem(req: Request, res: Response) {
  const { collection_id, novel_id } = itemParams.parse(req.params);
  await collectionsService.removeItem(collection_id, req.user!.user_id, novel_id);
  res.status(204).send();
}
