import type { Request, Response } from "express";
import { z } from "zod";
import * as libraryService from "@/modules/library/library.service";

export async function list(req: Request, res: Response) {
  const result = await libraryService.listLibrary(req.user!.user_id);
  res.status(200).json(result);
}

const addToLibraryBodySchema = z.object({ novel_id: z.string().uuid() });

export async function add(req: Request, res: Response) {
  const { novel_id } = addToLibraryBodySchema.parse(req.body);
  const entry = await libraryService.addToLibrary(req.user!.user_id, novel_id);
  res.status(201).json(entry);
}

const novelIdParamSchema = z.object({ novel_id: z.string().uuid() });

export async function remove(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  await libraryService.removeFromLibrary(req.user!.user_id, novel_id);
  res.status(204).send();
}
