import type { Request, Response } from "express";
import { z } from "zod";
import * as chaptersService from "@/modules/chapters/chapters.service";

const chapterIdParamSchema = z.object({ chapter_id: z.string().uuid() });

export async function getById(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const chapter = await chaptersService.getChapterById(chapter_id, req.user?.user_id);
  res.status(200).json(chapter);
}

const updateChapterBodySchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    content: z.string().optional(),
    status: z.enum(["draft", "published", "scheduled", "hidden"]).optional(),
    scheduled_publish_at: z.coerce.date().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" })
  .refine((v) => v.status !== "scheduled" || (v.scheduled_publish_at && v.scheduled_publish_at > new Date()), {
    message: "scheduled_publish_at is required and must be in the future when status is scheduled",
    path: ["scheduled_publish_at"],
  });

export async function update(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const body = updateChapterBodySchema.parse(req.body);
  const chapter = await chaptersService.updateChapter(chapter_id, req.user!.user_id, body);
  res.status(200).json(chapter);
}

export async function remove(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const trash = await chaptersService.deleteChapter(chapter_id, req.user!.user_id);
  res.status(200).json(trash);
}

const autosaveBodySchema = z.object({
  content_snapshot: z.string().min(1),
  // audit fix — เดิม autosave อัปเดตแค่ content ทำให้แก้ชื่อตอนแล้วรอ autosave (ไม่กด "บันทึกร่าง")
  // ชื่อตอนจริงในฐานข้อมูลไม่ถูกอัปเดตทั้งที่ UI ขึ้น "บันทึกแล้ว"
  title: z.string().trim().min(1).max(255).optional(),
});

export async function autosave(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const { content_snapshot, title } = autosaveBodySchema.parse(req.body);
  const version = await chaptersService.autosaveChapter(chapter_id, req.user!.user_id, content_snapshot, title);
  res.status(200).json(version);
}

export async function listVersions(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const result = await chaptersService.listChapterVersions(chapter_id, req.user!.user_id);
  res.status(200).json(result);
}

const restoreParamsSchema = z.object({
  chapter_id: z.string().uuid(),
  version_id: z.string().uuid(),
});

export async function restoreVersion(req: Request, res: Response) {
  const { chapter_id, version_id } = restoreParamsSchema.parse(req.params);
  const chapter = await chaptersService.restoreChapterVersion(chapter_id, version_id, req.user!.user_id);
  res.status(200).json(chapter);
}

export async function listComments(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const result = await chaptersService.listChapterComments(chapter_id, req.user?.user_id);
  res.status(200).json(result);
}

const createCommentBodySchema = z.object({
  content: z.string().trim().min(1).max(5000),
  parent_comment_id: z.string().uuid().optional(),
});

export async function createComment(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const body = createCommentBodySchema.parse(req.body);
  const comment = await chaptersService.createComment(chapter_id, req.user!.user_id, body);
  res.status(201).json(comment);
}
