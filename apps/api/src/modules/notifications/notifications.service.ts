import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "comment",
  "reply",
  "donation",
  "system",
  "new_chapter",
  "new_follower",
  "support_reply",
];

interface ListOptions {
  page?: number;
  pageSize?: number;
  type?: NotificationType;
  unread_only?: boolean;
}

/**
 * Reference implementation — GET /notifications
 * gap 3.3 — แบ่งหน้า + กรองประเภท/ยังไม่อ่าน + unread_count และซ่อนประเภทที่ผู้ใช้ปิดไว้
 * (เรียกแบบเดิมไม่ส่ง query = หน้าแรก 30 รายการล่าสุด — แผงแจ้งเตือนบน Navbar ใช้แบบนี้)
 */
export async function listNotifications(user_id: string, opts: ListOptions = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 30;
  const user = await prisma.user.findUnique({ where: { user_id }, select: { muted_notification_types: true } });
  const muted = user?.muted_notification_types ?? [];

  const base: Prisma.NotificationWhereInput = {
    user_id,
    ...(muted.length ? { type: { notIn: muted } } : {}),
  };
  const where: Prisma.NotificationWhereInput = {
    ...base,
    ...(opts.type ? { type: opts.type } : {}),
    ...(opts.unread_only ? { is_read: false } : {}),
  };
  // ประเภทที่ปิดไว้แล้วขอดูตรง ๆ ด้วย ?type= ก็ยังไม่แสดง (ปิดคือปิด)
  if (opts.type && muted.includes(opts.type)) {
    return { notifications: [], total: 0, page, pageSize, unread_count: await prisma.notification.count({ where: { ...base, is_read: false } }), muted_types: muted };
  }

  const [notifications, total, unread_count] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { notification_id: true, type: true, content: true, link_url: true, is_read: true, created_at: true },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...base, is_read: false } }),
  ]);

  return { notifications, total, page, pageSize, unread_count, muted_types: muted };
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

/** gap 3.3 — PATCH /notifications/read-all (กรองประเภทได้ ให้ตรงกับแท็บที่ผู้ใช้ดูอยู่) */
export async function markAllRead(user_id: string, type?: NotificationType) {
  const result = await prisma.notification.updateMany({
    where: { user_id, is_read: false, ...(type ? { type } : {}) },
    data: { is_read: true },
  });
  return { updated: result.count };
}

/** gap 3.3 — GET/PUT /notifications/preferences */
export async function getPreferences(user_id: string) {
  const user = await prisma.user.findUnique({ where: { user_id }, select: { muted_notification_types: true } });
  return { muted_types: user?.muted_notification_types ?? [], available_types: NOTIFICATION_TYPES };
}

export async function setPreferences(user_id: string, muted_types: NotificationType[]) {
  const user = await prisma.user.update({
    where: { user_id },
    data: { muted_notification_types: [...new Set(muted_types)] },
    select: { muted_notification_types: true },
  });
  return { muted_types: user.muted_notification_types, available_types: NOTIFICATION_TYPES };
}
