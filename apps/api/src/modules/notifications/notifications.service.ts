import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";

/** Reference implementation — GET /notifications */
export async function listNotifications(user_id: string) {
  const notifications = await prisma.notification.findMany({
    where: { user_id },
    orderBy: { created_at: "desc" },
    select: {
      notification_id: true,
      type: true,
      content: true,
      link_url: true,
      is_read: true,
      created_at: true,
    },
  });

  return { notifications };
}

/** Reference implementation — PATCH /notifications/:notification_id/read */
export async function markNotificationRead(notification_id: string, user_id: string) {
  const notification = await prisma.notification.findUnique({
    where: { notification_id },
    select: { user_id: true },
  });
  if (!notification) throw ApiError.notFound("Notification not found");
  if (notification.user_id !== user_id) throw ApiError.forbidden("Forbidden");

  const updated = await prisma.notification.update({
    where: { notification_id },
    data: { is_read: true },
    select: { notification_id: true, is_read: true },
  });

  return updated;
}
