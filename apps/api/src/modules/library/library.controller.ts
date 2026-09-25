import type { Request, Response } from "express";
import { z } from "zod";
import * as libraryService from "@/modules/library/library.service";

const statusSchema = z.enum(["reading", "up_next", "completed"]);

export async function list(req: Request, res: Response) {
  const { status } = z.object({ status: statusSchema.optional() }).parse(req.query);
  const result = await libraryService.listLibrary(req.user!.user_id, status);
  res.status(200).json(result);
}

const addToLibraryBodySchema = z.object({ novel_id: z.string().uuid(), status: statusSchema.optional() });

export async function add(req: Request, res: Response) {
  const { novel_id, status } = addToLibraryBodySchema.parse(req.body);
  const entry = await libraryService.addToLibrary(req.user!.user_id, novel_id, status);
  res.status(201).json(entry);
}

const novelIdParamSchema = z.object({ novel_id: z.string().uuid() });

export async function updateStatus(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const { status } = z.object({ status: statusSchema }).parse(req.body);
  const result = await libraryService.updateLibraryStatus(req.user!.user_id, novel_id, status);
  res.status(200).json(result);
}

export async function remove(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  await libraryService.removeFromLibrary(req.user!.user_id, novel_id);
  res.status(204).send();
}

export async function continueReading(req: Request, res: Response) {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(30).default(10) }).parse(req.query);
  const result = await libraryService.listContinueReading(req.user!.user_id, limit);
  res.status(200).json(result);
}
