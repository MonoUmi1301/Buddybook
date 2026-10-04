import type { SupportCategory, SupportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";

/**
 * gap 3.2 — ระบบสนับสนุนผู้ใช้งาน / แจ้งปัญหา (Proposal 1.3 ขอบเขตฝั่งผู้อ่าน)
 * ผู้ใช้เปิดเรื่อง → คุยโต้ตอบกับทีมงานในเรื่องเดียวกัน → ทีมงานตอบ/เปลี่ยนสถานะแล้วแจ้งเตือนกลับ
 */

const STATUS_LABEL: Record<SupportStatus, string> = {
  open: "รอดำเนินการ",
  in_progress: "กำลังดำเนินการ",
  resolved: "แก้ไขแล้ว",
  closed: "ปิดเรื่องแล้ว",
};

const ticketSummarySelect = {
  ticket_id: true,
  category: true,
  subject: true,
  status: true,
  created_at: true,
  updated_at: true,
  _count: { select: { messages: true } },
} as const;

interface Viewer {
  user_id: string;
  role: string;
}

async function getTicketFor(ticket_id: string, viewer: Viewer) {
  const ticket = await prisma.supportTicket.findUnique({ where: { ticket_id }, select: { user_id: true, status: true, subject: true } });
  // เจ้าของหรือแอดมินเท่านั้น — คนอื่นได้ 404 (ไม่ยืนยันว่ามีเรื่องนี้อยู่)
  if (!ticket || (ticket.user_id !== viewer.user_id && viewer.role !== "admin")) {
    throw ApiError.notFound("Ticket not found");
  }
  return ticket;
}

async function notifyOwner(user_id: string, ticket_id: string, content: string) {
  await prisma.notification.create({
    data: { user_id, type: "support_reply", content, link_url: `/support/${ticket_id}` },
  });
}

export async function createTicket(
  user_id: string,
  input: { category: SupportCategory; subject: string; body: string; attachment_url?: string }
) {
  return prisma.supportTicket.create({
    data: {
      user_id,
      category: input.category,
      subject: input.subject,
      messages: { create: { author_id: user_id, body: input.body, attachment_url: input.attachment_url } },
    },
    select: ticketSummarySelect,
  });
}

export async function listMyTickets(user_id: string) {
  const tickets = await prisma.supportTicket.findMany({
    where: { user_id },
    orderBy: { updated_at: "desc" },
    select: {
      ...ticketSummarySelect,
      messages: { orderBy: { created_at: "desc" }, take: 1, select: { is_staff: true, created_at: true } },
    },
  });
  return {
    tickets: tickets.map(({ messages, _count, ...t }) => ({
      ...t,
      message_count: _count.messages,
      // ข้อความล่าสุดเป็นของทีมงาน = มีคำตอบใหม่รอผู้ใช้อ่าน
      awaiting_user: messages[0]?.is_staff ?? false,
    })),
  };
}

export async function getTicket(ticket_id: string, viewer: Viewer) {
  await getTicketFor(ticket_id, viewer);
  const ticket = await prisma.supportTicket.findUniqueOrThrow({
    where: { ticket_id },
    select: {
      ...ticketSummarySelect,
      user: { select: { user_id: true, username: true, email: true } },
      messages: {
        orderBy: { created_at: "asc" },
        select: {
          message_id: true,
          is_staff: true,
          body: true,
          attachment_url: true,
          created_at: true,
          author: { select: { user_id: true, username: true } },
        },
      },
    },
  });
  const isAdmin = viewer.role === "admin";
  const { _count, user, ...rest } = ticket;
  return {
    ...rest,
    message_count: _count.messages,
    // อีเมลผู้แจ้งเห็นเฉพาะทีมงาน; ชื่อแอดมินที่ตอบไม่เปิดเผยให้ผู้ใช้ (แสดงเป็น "ทีมงาน")
    user: isAdmin ? user : { user_id: user.user_id, username: user.username },
    messages: ticket.messages.map((m) => ({
      ...m,
      author: m.is_staff && !isAdmin ? null : m.author,
    })),
  };
}

export async function addMessage(ticket_id: string, viewer: Viewer, input: { body: string; attachment_url?: string }) {
  const ticket = await getTicketFor(ticket_id, viewer);
  const isStaff = viewer.role === "admin" && ticket.user_id !== viewer.user_id;
  if (ticket.status === "closed" && !isStaff) {
    throw ApiError.conflict("เรื่องนี้ปิดไปแล้ว กรุณาเปิดเรื่องใหม่");
  }

  // ทีมงานตอบ → กำลังดำเนินการ; ผู้ใช้ตอบกลับเรื่องที่ "แก้ไขแล้ว" → เปิดใหม่ (ยังไม่จบจริง)
  const nextStatus: SupportStatus | undefined = isStaff
    ? ticket.status === "open"
      ? "in_progress"
      : undefined
    : ticket.status === "resolved"
      ? "open"
      : undefined;

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticket_id, author_id: viewer.user_id, is_staff: isStaff, body: input.body, attachment_url: input.attachment_url },
      select: { message_id: true, is_staff: true, body: true, attachment_url: true, created_at: true },
    }),
    prisma.supportTicket.update({
      where: { ticket_id },
      data: { updated_at: new Date(), ...(nextStatus ? { status: nextStatus } : {}) },
    }),
  ]);

  if (isStaff) await notifyOwner(ticket.user_id, ticket_id, `ทีมงานตอบกลับเรื่อง "${ticket.subject}" แล้ว`);
  return message;
}

export async function updateStatus(ticket_id: string, viewer: Viewer, status: SupportStatus) {
  const ticket = await getTicketFor(ticket_id, viewer);
  const isStaff = viewer.role === "admin" && ticket.user_id !== viewer.user_id;
  // เจ้าของเรื่องทำได้แค่ปิดเรื่องเอง (ปัญหาหายแล้ว) — สถานะอื่นทีมงานเป็นคนตั้ง
  if (!isStaff && status !== "closed") throw ApiError.forbidden("ผู้ใช้ปิดเรื่องได้เท่านั้น");

  const updated = await prisma.supportTicket.update({
    where: { ticket_id },
    data: { status, updated_at: new Date() },
    select: ticketSummarySelect,
  });
  if (isStaff && status !== ticket.status) {
    await notifyOwner(ticket.user_id, ticket_id, `เรื่อง "${ticket.subject}" เปลี่ยนสถานะเป็น "${STATUS_LABEL[status]}"`);
  }
  return updated;
}

/** GET /admin/support/tickets — คิวงานของทีมงาน เรียงเรื่องที่ค้างนานสุดก่อน */
export async function adminListTickets(status?: SupportStatus) {
  const tickets = await prisma.supportTicket.findMany({
    where: status ? { status } : { status: { in: ["open", "in_progress"] } },
    orderBy: { updated_at: "asc" },
    take: 200,
    select: {
      ...ticketSummarySelect,
      user: { select: { user_id: true, username: true, email: true } },
      messages: { orderBy: { created_at: "desc" }, take: 1, select: { is_staff: true } },
    },
  });
  return {
    tickets: tickets.map(({ messages, _count, ...t }) => ({
      ...t,
      message_count: _count.messages,
      awaiting_staff: !(messages[0]?.is_staff ?? false),
    })),
  };
}
