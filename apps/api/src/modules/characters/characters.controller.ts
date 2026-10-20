import type { Request, Response } from "express";
import { z } from "zod";
import * as charactersService from "@/modules/characters/characters.service";
import { ApiError } from "@/utils/ApiError";

const novelIdParamSchema = z.object({ novel_id: z.string().uuid() });
const nodeIdParamSchema = z.object({ node_id: z.string().uuid() });
const edgeIdParamSchema = z.object({ edge_id: z.string().uuid() });
const characterRoleEnum = z.enum(["protagonist", "antagonist", "supporting"]);

// เพิ่มภายหลัง — รูปตัวละครรับได้ทั้ง URL เต็ม (อัปโหลดขึ้น Cloudinary) และอวาตาร์สำเร็จรูปของเว็บ
// ที่เป็น path ในโปรเจกต์ (apps/web/public/characters/*) เช่น "/characters/top.png"
const characterAvatarSchema = z
  .string()
  .url()
  .or(z.string().regex(/^\/characters\/[\w-]+\.(png|jpe?g|webp|svg)$/));

const createCharacterBodySchema = z.object({
  character_name: z.string().trim().min(1).max(100),
  avatar_url: characterAvatarSchema.optional(),
  description: z.string().max(10000).optional(),
  character_role: characterRoleEnum.optional(),
  position_x: z.number().optional(),
  position_y: z.number().optional(),
});

export async function create(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createCharacterBodySchema.parse(req.body);
  const node = await charactersService.createCharacterNode(novel_id, req.user!.user_id, body);
  res.status(201).json(node);
}

const updateCharacterBodySchema = z
  .object({
    character_name: z.string().trim().min(1).max(100).optional(),
    avatar_url: characterAvatarSchema.optional(),
    description: z.string().max(10000).optional(),
    character_role: characterRoleEnum.optional(),
    position_x: z.number().optional(),
    position_y: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export async function update(req: Request, res: Response) {
  const { node_id } = nodeIdParamSchema.parse(req.params);
  const body = updateCharacterBodySchema.parse(req.body);
  const node = await charactersService.updateCharacterNode(node_id, req.user!.user_id, body);
  res.status(200).json(node);
}

export async function remove(req: Request, res: Response) {
  const { node_id } = nodeIdParamSchema.parse(req.params);
  const trash = await charactersService.deleteCharacterNode(node_id, req.user!.user_id);
  res.status(200).json(trash);
}

const edgeTypeEnum = z.enum(["default", "straight", "smoothstep"]);

const createEdgeBodySchema = z.object({
  source_node_id: z.string().uuid(),
  target_node_id: z.string().uuid(),
  relationship_type: z.string().trim().max(50).optional(),
  edge_label: z.string().trim().max(100).optional(),
  description: z.string().max(10000).optional(),
  // เพิ่มภายหลัง (audit fix) — ผู้ใช้ขอเลือกรูปแบบเส้นได้ (ตรง/หักมุม/โค้ง) — คอลัมน์ edge_type
  // มีอยู่แล้วในสคีมาเดิมแต่ไม่เคยมี UI ไหนตั้งค่าได้จริงมาก่อน
  edge_type: edgeTypeEnum.optional(),
  // เพิ่มภายหลัง — จุดต่อเส้นที่ผู้ใช้ลาก (บน/ขวา/ล่าง/ซ้าย) เดิมไม่ได้บันทึก รีเฟรชแล้วเส้นย้ายจุดเอง
  source_handle: z.enum(["top", "right", "bottom", "left"]).optional(),
  target_handle: z.enum(["top", "right", "bottom", "left"]).optional(),
});

export async function createEdge(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createEdgeBodySchema.parse(req.body);

  if (body.source_node_id === body.target_node_id) {
    throw ApiError.unprocessable("A character cannot be linked to itself");
  }

  const edge = await charactersService.createCharacterEdge(novel_id, req.user!.user_id, body);
  res.status(201).json(edge);
}

const updateEdgeBodySchema = z
  .object({
    relationship_type: z.string().trim().max(50).optional(),
    edge_label: z.string().trim().max(100).optional(),
    description: z.string().max(10000).optional(),
    edge_type: edgeTypeEnum.optional(),
    // เพิ่มภายหลัง — ลากปลายเส้นไปต่อจุดใหม่/ตัวละครใหม่ได้โดยไม่ต้องลบเส้น (react-flow onReconnect)
    source_node_id: z.string().uuid().optional(),
    target_node_id: z.string().uuid().optional(),
    source_handle: z.enum(["top", "right", "bottom", "left"]).nullable().optional(),
    target_handle: z.enum(["top", "right", "bottom", "left"]).nullable().optional(),
    // เพิ่มภายหลัง — สีเส้น + หัวลูกศร (เก็บในคอลัมน์ edge_style JSONB ที่มีอยู่แล้ว)
    // arrow: end = ชี้จากตัวต้นทางไปปลายทาง, start = กลับทาง, both = สองทาง
    edge_style: z
      .object({
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        arrow: z.enum(["none", "end", "start", "both"]),
      })
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export async function updateEdge(req: Request, res: Response) {
  const { edge_id } = edgeIdParamSchema.parse(req.params);
  const body = updateEdgeBodySchema.parse(req.body);
  const edge = await charactersService.updateCharacterEdge(edge_id, req.user!.user_id, body);
  res.status(200).json(edge);
}

export async function removeEdge(req: Request, res: Response) {
  const { edge_id } = edgeIdParamSchema.parse(req.params);
  const trash = await charactersService.deleteCharacterEdge(edge_id, req.user!.user_id);
  res.status(200).json(trash);
}
