import type { Request, Response } from "express";
import { z } from "zod";
import * as notificationsService from "@/modules/notifications/notifications.service";

export async function list(req: Request, res: Response) {
  const result = await notificationsService.listNotifications(req.user!.user_id);
  res.status(200).json(result);
}

const notificationIdParamSchema = z.object({ notification_id: z.string().uuid() });

export async function markRead(req: Request, res: Response) {
  const { notification_id } = notificationIdParamSchema.parse(req.params);
  const result = await notificationsService.markNotificationRead(notification_id, req.user!.user_id);
  res.status(200).json(result);
}
