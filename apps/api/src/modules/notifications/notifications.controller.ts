import type { Request, Response } from "express";
import { z } from "zod";
import * as notificationsService from "@/modules/notifications/notifications.service";

const typeEnum = z.enum(["comment", "reply", "donation", "system", "new_chapter", "new_follower", "support_reply"]);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  type: typeEnum.optional(),
  unread_only: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export async function list(req: Request, res: Response) {
  const query = listQuerySchema.parse(req.query);
  const result = await notificationsService.listNotifications(req.user!.user_id, query);
  res.status(200).json(result);
}

const notificationIdParamSchema = z.object({ notification_id: z.string().uuid() });

export async function markRead(req: Request, res: Response) {
  const { notification_id } = notificationIdParamSchema.parse(req.params);
  const result = await notificationsService.markNotificationRead(notification_id, req.user!.user_id);
  res.status(200).json(result);
}

export async function markAllRead(req: Request, res: Response) {
  const { type } = z.object({ type: typeEnum.optional() }).parse(req.body ?? {});
  res.status(200).json(await notificationsService.markAllRead(req.user!.user_id, type));
}

export async function getPreferences(req: Request, res: Response) {
  res.status(200).json(await notificationsService.getPreferences(req.user!.user_id));
}

export async function setPreferences(req: Request, res: Response) {
  const { muted_types } = z.object({ muted_types: z.array(typeEnum).max(7) }).parse(req.body);
  res.status(200).json(await notificationsService.setPreferences(req.user!.user_id, muted_types));
}
