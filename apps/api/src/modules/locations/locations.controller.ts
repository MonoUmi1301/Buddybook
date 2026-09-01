import type { Request, Response } from "express";
import { z } from "zod";
import * as locationsService from "@/modules/locations/locations.service";

const novelIdParamSchema = z.object({ novel_id: z.string().uuid() });
const locationIdParamSchema = z.object({ location_id: z.string().uuid() });

const createLocationBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(10000).optional(),
  map_icon_url: z.string().trim().max(255).optional(),
  category: z.string().trim().max(50).optional(),
  pos_x: z.number().optional(),
  pos_y: z.number().optional(),
});

export async function create(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createLocationBodySchema.parse(req.body);
  const location = await locationsService.createLocation(novel_id, req.user!.user_id, body);
  res.status(201).json(location);
}

const updateLocationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(10000).optional(),
    map_icon_url: z.string().trim().max(255).optional(),
    category: z.string().trim().max(50).optional(),
    pos_x: z.number().optional(),
    pos_y: z.number().optional(),
    // เพิ่มภายหลัง (audit fix) — ย่อ-ขยาย/หมุน/พลิก/ลำดับซ้อนทับ + หมุดผูกฐานข้อมูล (lore link)
    scale: z.number().min(0.3).max(3).optional(),
    rotation: z.number().min(-360).max(360).optional(),
    flip_x: z.boolean().optional(),
    z_index: z.number().int().min(-1000).max(1000).optional(),
    linked_chapter_id: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export async function update(req: Request, res: Response) {
  const { location_id } = locationIdParamSchema.parse(req.params);
  const body = updateLocationBodySchema.parse(req.body);
  const location = await locationsService.updateLocation(location_id, req.user!.user_id, body);
  res.status(200).json(location);
}

export async function remove(req: Request, res: Response) {
  const { location_id } = locationIdParamSchema.parse(req.params);
  const trash = await locationsService.deleteLocation(location_id, req.user!.user_id);
  res.status(200).json(trash);
}

const edgeIdParamSchema = z.object({ edge_id: z.string().uuid() });

export async function removeEdge(req: Request, res: Response) {
  const { edge_id } = edgeIdParamSchema.parse(req.params);
  const trash = await locationsService.deleteLocationEdge(edge_id, req.user!.user_id);
  res.status(200).json(trash);
}
