import type { Request, Response } from "express";
import { z } from "zod";
import * as chaptersService from "@/modules/chapters/chapters.service";
import { STICKER_IDS } from "@/lib/stickers";

const chapterIdParamSchema = z.object({ chapter_id: z.string().uuid() });

export async function getById(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  // ผู้อ่านที่ไม่ล็อกอินแยกกันด้วย IP ของเบราว์เซอร์ (Next proxy ส่ง X-Forwarded-For มา) — ใช้นับยอดวิวเท่านั้น
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || req.ip;
  const chapter = await chaptersService.getChapterById(chapter_id, req.user?.user_id, ip ? `ip:${ip}` : undefined);
  res.status(200).json(chapter);
}

const updateChapterBodySchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    content: z.string().optional(),
    status: z.enum(["draft", "published", "scheduled", "hidden"]).optional(),
    scheduled_publish_at: z.coerce.date().optional(),
    // เพิ่มภายหลัง (ตอนติดเหรียญ) — 0 = ฟรี
    price_coins: z.number().int().min(0).max(1000).optional(),
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
  // gap 2.5 — updated_at ของตอนที่ editor เห็นล่าสุด (ตรวจการแก้ไขชนกันข้ามแท็บ — ดู service)
  base_updated_at: z.coerce.date().optional(),
});

export async function autosave(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const { content_snapshot, title, base_updated_at } = autosaveBodySchema.parse(req.body);
  const version = await chaptersService.autosaveChapter(
    chapter_id,
    req.user!.user_id,
    content_snapshot,
    title,
    base_updated_at
  );
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

export async function purchase(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const result = await chaptersService.purchaseChapter(req.user!.user_id, chapter_id);
  res.status(result.already_owned ? 200 : 201).json(result);
}

export async function listComments(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const result = await chaptersService.listChapterComments(chapter_id, req.user?.user_id);
  res.status(200).json(result);
}

// เพิ่มภายหลัง — คอมเมนต์เป็นสติกเกอร์อย่างเดียวได้ (content ว่าง) แต่ต้องมีอย่างใดอย่างหนึ่ง
const createCommentBodySchema = z
  .object({
    content: z.string().trim().max(5000).default(""),
    sticker_id: z.enum(STICKER_IDS).optional(),
    parent_comment_id: z.string().uuid().optional(),
  })
  .refine((v) => v.content.length > 0 || v.sticker_id, { message: "content or sticker_id is required" });

export async function createComment(req: Request, res: Response) {
  const { chapter_id } = chapterIdParamSchema.parse(req.params);
  const body = createCommentBodySchema.parse(req.body);
  const comment = await chaptersService.createComment(chapter_id, req.user!.user_id, body);
  res.status(201).json(comment);
}
