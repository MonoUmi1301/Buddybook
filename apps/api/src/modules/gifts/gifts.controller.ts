import type { Request, Response } from "express";
import { z } from "zod";
import * as giftsService from "@/modules/gifts/gifts.service";

const uuid = z.string().uuid();

// ข้อความรับยาวกว่าเพดานจริงได้ (2000) เพราะ HTML/อีโมจิที่จะถูกลบออกนับอยู่ในนี้ด้วย — เพดานจริง
// (500 ตัวอักษรหลังทำความสะอาด) ตรวจใน sanitizeCardText ให้ตรงกับตัวนับฝั่งหน้าเว็บ
const cardSchema = z.object({
  template: z.enum(["stamp", "matcha", "navy", "bear"]).optional(),
  message: z.string().max(2000).optional(),
  signature_name: z.string().max(200).optional(),
  is_anonymous: z.boolean().optional(),
  is_public: z.boolean().optional(),
});

// ไม่มีฟิลด์ราคาให้ส่งมาเลย — ถ้า client แนบ price/amount มาเอง zod ตัดทิ้ง (ไม่ใช้ .strict()) และ
// ราคาอ่านจาก gift_items ฝั่ง server เสมอ (ดู resolvePrice ใน gifts.service.ts)
const sendBodySchema = z
  .object({
    author_id: uuid,
    novel_id: uuid.optional(),
    chapter_id: uuid.optional(),
    gift_id: uuid.optional(),
    custom_coins: z.number().int().positive().optional(),
    quantity: z.number().int().min(1).max(99).optional(),
    card: cardSchema.optional(),
    idempotency_key: z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  })
  .refine((b) => (b.gift_id === undefined) !== (b.custom_coins === undefined), {
    message: "Send exactly one of gift_id or custom_coins",
  });

export async function catalog(_req: Request, res: Response) {
  res.status(200).json(await giftsService.listCatalog());
}

export async function send(req: Request, res: Response) {
  const body = sendBodySchema.parse(req.body);
  const result = await giftsService.sendGift(req.user!.user_id, body);
  res.status(result.replayed ? 200 : 201).json(result);
}

const publicQuerySchema = z.object({ novel_id: uuid.optional() });

export async function publicGifts(req: Request, res: Response) {
  const author_id = uuid.parse(req.params.user_id);
  const { novel_id } = publicQuerySchema.parse(req.query);
  res.status(200).json(await giftsService.listPublicGifts(author_id, { novel_id, viewer_id: req.user?.user_id }));
}

export async function supporterBadges(req: Request, res: Response) {
  const user_id = uuid.parse(req.params.user_id);
  res.status(200).json(await giftsService.getSupporterBadges(user_id));
}

const receivedQuerySchema = z.object({
  cursor: uuid.optional(),
  novel_id: uuid.optional(),
  gift_id: uuid.optional(),
  status: z.enum(["hidden", "unread"]).optional(),
});

export async function received(req: Request, res: Response) {
  const filter = receivedQuerySchema.parse(req.query);
  res.status(200).json(await giftsService.listReceived(req.user!.user_id, filter));
}

export async function stats(req: Request, res: Response) {
  res.status(200).json(await giftsService.getReceivedStats(req.user!.user_id));
}

export async function sent(req: Request, res: Response) {
  const { cursor } = z.object({ cursor: uuid.optional() }).parse(req.query);
  res.status(200).json(await giftsService.listSent(req.user!.user_id, cursor));
}

const thankBodySchema = z.object({ message: z.string().min(1).max(1000) }).strict();

export async function thank(req: Request, res: Response) {
  const donation_id = uuid.parse(req.params.donation_id);
  const { message } = thankBodySchema.parse(req.body);
  res.status(200).json(await giftsService.thankGift(req.user!.user_id, donation_id, message));
}

const updateReceivedSchema = z
  .object({
    read: z.boolean().optional(),
    hidden: z.boolean().optional(),
    report_reason: z.string().max(1000).optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" });

export async function updateReceived(req: Request, res: Response) {
  const donation_id = uuid.parse(req.params.donation_id);
  const body = updateReceivedSchema.parse(req.body);
  res.status(200).json(await giftsService.updateReceived(req.user!.user_id, donation_id, body));
}

// --- Admin ---

const giftItemBaseSchema = z.object({
  slug: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/),
  name_th: z.string().trim().min(1).max(100),
  name_en: z.string().trim().min(1).max(100),
  description_th: z.string().trim().max(500).nullable().optional(),
  price_coins: z.number().int().positive().max(1_000_000),
  tier: z.enum(["S", "M", "L", "XL"]),
  image_url: z.string().trim().min(1).max(500),
  animation: z.enum(["none", "pop", "float", "sparkle"]).optional(),
  is_active: z.boolean().optional(),
  is_limited: z.boolean().optional(),
  available_from: z.coerce.date().nullable().optional(),
  available_to: z.coerce.date().nullable().optional(),
  sort_order: z.number().int().optional(),
});

const windowIsValid = (b: { available_from?: Date | null; available_to?: Date | null }) =>
  !b.available_from || !b.available_to || b.available_from < b.available_to;

export async function adminList(_req: Request, res: Response) {
  res.status(200).json({ items: await giftsService.adminListGifts() });
}

export async function adminCreate(req: Request, res: Response) {
  const body = giftItemBaseSchema.strict().refine(windowIsValid, { message: "available_from must be before available_to" }).parse(req.body);
  res.status(201).json(await giftsService.adminCreateGift(body));
}

export async function adminUpdate(req: Request, res: Response) {
  const gift_id = uuid.parse(req.params.gift_id);
  const body = giftItemBaseSchema
    .partial()
    .strict()
    .refine(windowIsValid, { message: "available_from must be before available_to" })
    .parse(req.body);
  res.status(200).json(await giftsService.adminUpdateGift(gift_id, body));
}

export async function adminDelete(req: Request, res: Response) {
  const gift_id = uuid.parse(req.params.gift_id);
  res.status(200).json(await giftsService.adminDeleteGift(gift_id));
}

export async function adminReports(req: Request, res: Response) {
  const { cursor } = z.object({ cursor: uuid.optional() }).parse(req.query);
  res.status(200).json(await giftsService.adminListReports(cursor));
}

export async function adminResolveReport(req: Request, res: Response) {
  const donation_id = uuid.parse(req.params.donation_id);
  const { action } = z.object({ action: z.enum(["dismiss", "hide"]) }).strict().parse(req.body);
  res.status(200).json(await giftsService.adminResolveReport(donation_id, action));
}
