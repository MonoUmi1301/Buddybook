import type { Request, Response } from "express";
import { z } from "zod";
import * as adminService from "@/modules/admin/admin.service";

export async function pendingNovels(_req: Request, res: Response) {
  const result = await adminService.listPendingNovels();
  res.status(200).json(result);
}

const novelIdParamSchema = z.object({ novel_id: z.string().uuid() });

export async function approveNovel(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await adminService.approveNovel(novel_id);
  res.status(200).json(result);
}

const rejectNovelBodySchema = z.object({ reason: z.string().trim().min(1).max(1000) });

export async function rejectNovel(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const { reason } = rejectNovelBodySchema.parse(req.body);
  const result = await adminService.rejectNovel(novel_id, reason);
  res.status(200).json(result);
}

const paginationQuerySchema = z.object({ page: z.coerce.number().int().positive().default(1) });

export async function listUsers(req: Request, res: Response) {
  const { page } = paginationQuerySchema.parse(req.query);
  const result = await adminService.listUsers(page);
  res.status(200).json(result);
}

const userIdParamSchema = z.object({ user_id: z.string().uuid() });
const updateUserRoleBodySchema = z.object({ role: z.enum(["admin", "user"]) });

export async function updateUserRole(req: Request, res: Response) {
  const { user_id } = userIdParamSchema.parse(req.params);
  const { role } = updateUserRoleBodySchema.parse(req.body);
  const result = await adminService.updateUserRole(user_id, role);
  res.status(200).json(result);
}

export async function suspendUser(req: Request, res: Response) {
  const { user_id } = userIdParamSchema.parse(req.params);
  const result = await adminService.suspendUser(user_id);
  res.status(200).json(result);
}

export async function listTags(_req: Request, res: Response) {
  const result = await adminService.listTags();
  res.status(200).json(result);
}

// audit fix — เดิมขาด "pairing"/"freeform" ทั้งที่ TagCategory enum (schema.prisma) ตั้งใจให้ทั้งคู่
// เป็น admin-curated preset (มีแค่ "fandom" เท่านั้นที่ตั้งใจให้ไม่มี admin preset — สร้างผ่านหน้า
// เขียนนิยาย free-type เท่านั้น ดู novels.service.ts resolveTagNames) — แก้ให้ตรงกับ MASTER BRIEF
// ที่ pairing/freeform ต้องจัดการผ่านหน้า admin ได้จริง ไม่ใช่แค่มี category ในฐานข้อมูลเฉย ๆ
const tagCategoryEnum = z.enum(["genre", "mood", "pairing", "freeform", "theme"]);
const createTagBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  category: tagCategoryEnum.optional(),
});

export async function createTag(req: Request, res: Response) {
  const body = createTagBodySchema.parse(req.body);
  const result = await adminService.createTag(body.name, body.category);
  res.status(201).json(result);
}

const tagIdParamSchema = z.object({ tag_id: z.coerce.number().int().positive() });
const updateTagBodySchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    category: tagCategoryEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export async function updateTag(req: Request, res: Response) {
  const { tag_id } = tagIdParamSchema.parse(req.params);
  const body = updateTagBodySchema.parse(req.body);
  const result = await adminService.updateTag(tag_id, body);
  res.status(200).json(result);
}

export async function deleteTag(req: Request, res: Response) {
  const { tag_id } = tagIdParamSchema.parse(req.params);
  await adminService.deleteTag(tag_id);
  res.status(204).send();
}

export async function stats(_req: Request, res: Response) {
  const result = await adminService.getStats();
  res.status(200).json(result);
}
