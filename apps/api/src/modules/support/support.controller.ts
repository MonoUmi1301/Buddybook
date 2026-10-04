import type { Request, Response } from "express";
import { z } from "zod";
import * as supportService from "@/modules/support/support.service";

const ticketParam = z.object({ ticket_id: z.string().uuid() });
const categoryEnum = z.enum(["account", "payment", "bug", "content", "other"]);
const statusEnum = z.enum(["open", "in_progress", "resolved", "closed"]);
// รูปแนบต้องมาจาก Cloudinary (อัปโหลดผ่าน /uploads/sign) — ไม่รับลิงก์ภายนอกอื่น ๆ
const attachment = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://res.cloudinary.com/"), "รองรับเฉพาะรูปที่อัปโหลดผ่านระบบ")
  .optional();

const createSchema = z.object({
  category: categoryEnum,
  subject: z.string().trim().min(4).max(150),
  body: z.string().trim().min(10).max(5000),
  attachment_url: attachment,
});
const messageSchema = z.object({ body: z.string().trim().min(1).max(5000), attachment_url: attachment });

const viewer = (req: Request) => ({ user_id: req.user!.user_id, role: req.user!.role });

export async function create(req: Request, res: Response) {
  const body = createSchema.parse(req.body);
  res.status(201).json(await supportService.createTicket(req.user!.user_id, body));
}

export async function listMine(req: Request, res: Response) {
  res.status(200).json(await supportService.listMyTickets(req.user!.user_id));
}

export async function get(req: Request, res: Response) {
  const { ticket_id } = ticketParam.parse(req.params);
  res.status(200).json(await supportService.getTicket(ticket_id, viewer(req)));
}

export async function addMessage(req: Request, res: Response) {
  const { ticket_id } = ticketParam.parse(req.params);
  const body = messageSchema.parse(req.body);
  res.status(201).json(await supportService.addMessage(ticket_id, viewer(req), body));
}

export async function updateStatus(req: Request, res: Response) {
  const { ticket_id } = ticketParam.parse(req.params);
  const { status } = z.object({ status: statusEnum }).parse(req.body);
  res.status(200).json(await supportService.updateStatus(ticket_id, viewer(req), status));
}

export async function adminList(req: Request, res: Response) {
  const { status } = z.object({ status: statusEnum.optional() }).parse(req.query);
  res.status(200).json(await supportService.adminListTickets(status));
}
