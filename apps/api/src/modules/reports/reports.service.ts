import { Prisma } from "@prisma/client";
import type { ReportReason, ReportStatus, ReportTargetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { setUserSuspendedCache } from "@/lib/suspension";

/**
 * เพิ่มภายหลัง (รายงานเนื้อหา) — ผู้ใช้รายงานนิยาย/ตอน/คอมเมนต์/รีวิว/ผู้ใช้ที่ไม่เหมาะสม แอดมินตรวจที่
 * /admin/content-reports แล้วเลือก dismiss (ไม่พบปัญหา) หรือ action (จัดการเนื้อหาตามชนิด):
 *   novel → ตั้ง visibility เป็น private · chapter → ซ่อน (status hidden) · comment/review → ลบ · user → ระงับบัญชี
 * รายงานอื่นที่ยังเปิดอยู่ของเป้าหมายเดียวกันถูกปิดตามไปด้วย และผู้รายงานทุกคนได้แจ้งเตือนผลการตรวจ
 */

interface TargetInfo {
  /** เจ้าของเนื้อหา — ห้ามรายงานของตัวเอง */
  owner_id: string;
  preview: string;
  link_url: string | null;
}

async function loadTarget(target_type: ReportTargetType, target_id: string): Promise<TargetInfo | null> {
  switch (target_type) {
    case "novel": {
      const n = await prisma.novel.findUnique({
        where: { novel_id: target_id },
        select: { author_id: true, title: true, visibility: true },
      });
      return n ? { owner_id: n.author_id, preview: n.title, link_url: `/novels/${target_id}` } : null;
    }
    case "chapter": {
      const c = await prisma.chapter.findUnique({
        where: { chapter_id: target_id },
        select: { title: true, chapter_number: true, novel_id: true, novel: { select: { author_id: true, title: true } } },
      });
      return c
        ? {
            owner_id: c.novel.author_id,
            preview: `${c.novel.title} — ตอนที่ ${c.chapter_number} ${c.title}`,
            link_url: `/novels/${c.novel_id}/chapters/${target_id}`,
          }
        : null;
    }
    case "comment": {
      const c = await prisma.comment.findUnique({
        where: { comment_id: target_id },
        select: { user_id: true, content: true, chapter_id: true, chapter: { select: { novel_id: true } } },
      });
      return c
        ? {
            owner_id: c.user_id,
            preview: c.content.slice(0, 300),
            link_url: `/novels/${c.chapter.novel_id}/chapters/${c.chapter_id}`,
          }
        : null;
    }
    case "review": {
      const r = await prisma.review.findUnique({
        where: { review_id: target_id },
        select: { user_id: true, comment_text: true, rating: true, novel_id: true },
      });
      return r
        ? {
            owner_id: r.user_id,
            preview: `${r.rating ?? "-"}★ ${(r.comment_text ?? "").slice(0, 300)}`,
            link_url: `/novels/${r.novel_id}`,
          }
        : null;
    }
    case "user": {
      const u = await prisma.user.findUnique({
        where: { user_id: target_id },
        select: { username: true, pen_name: true },
      });
      return u ? { owner_id: target_id, preview: u.pen_name || u.username, link_url: `/profile/${target_id}` } : null;
    }
  }
}

export interface CreateReportInput {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details?: string;
}

export async function createReport(reporter_id: string, input: CreateReportInput) {
  const target = await loadTarget(input.target_type, input.target_id);
  if (!target) throw ApiError.notFound("Reported content not found");
  if (target.owner_id === reporter_id) throw ApiError.unprocessable("You cannot report your own content");

  try {
    return await prisma.contentReport.create({
      data: { reporter_id, ...input, details: input.details || null },
      select: { report_id: true, target_type: true, target_id: true, reason: true, status: true, created_at: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("คุณรายงานเนื้อหานี้ไปแล้ว");
    }
    throw err;
  }
}

const PAGE_SIZE = 30;

/** GET /admin/content-reports?status=open — พร้อม preview เนื้อหาเป้าหมาย (null = ถูกลบไปแล้ว) */
export async function listReports(status: ReportStatus = "open", cursor?: string) {
  const rows = await prisma.contentReport.findMany({
    where: { status },
    orderBy: [{ created_at: status === "open" ? "asc" : "desc" }, { report_id: "asc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { report_id: cursor }, skip: 1 } : {}),
    select: {
      report_id: true,
      target_type: true,
      target_id: true,
      reason: true,
      details: true,
      status: true,
      admin_note: true,
      resolved_at: true,
      created_at: true,
      reporter: { select: { user_id: true, username: true } },
    },
  });
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const reports = await Promise.all(
    page.map(async (r) => {
      const [target, open_report_count] = await Promise.all([
        loadTarget(r.target_type, r.target_id),
        prisma.contentReport.count({ where: { target_type: r.target_type, target_id: r.target_id, status: "open" } }),
      ]);
      return {
        ...r,
        target: target ? { preview: target.preview, link_url: target.link_url, owner_id: target.owner_id } : null,
        open_report_count,
      };
    })
  );

  return { reports, next_cursor: hasMore ? page[page.length - 1].report_id : null };
}

async function applyAction(target_type: ReportTargetType, target_id: string) {
  switch (target_type) {
    case "novel":
      await prisma.novel.updateMany({ where: { novel_id: target_id }, data: { visibility: "private" } });
      return;
    case "chapter":
      await prisma.chapter.updateMany({ where: { chapter_id: target_id }, data: { status: "hidden" } });
      return;
    case "comment":
      await prisma.comment.deleteMany({ where: { comment_id: target_id } });
      return;
    case "review":
      await prisma.review.deleteMany({ where: { review_id: target_id } });
      return;
    case "user": {
      const res = await prisma.user.updateMany({ where: { user_id: target_id }, data: { is_suspended: true } });
      if (res.count) setUserSuspendedCache(target_id, true);
      return;
    }
  }
}

const RESULT_TEXT: Record<"dismiss" | "action", string> = {
  dismiss: "ตรวจสอบแล้วไม่พบการละเมิดกฎ",
  action: "ตรวจสอบแล้วและได้จัดการเนื้อหานั้นเรียบร้อย ขอบคุณที่ช่วยดูแลชุมชน",
};

/** PATCH /admin/content-reports/:report_id — ปิดรายงานนี้ + รายงานที่ยังเปิดอยู่ของเป้าหมายเดียวกัน */
export async function resolveReport(report_id: string, admin_id: string, action: "dismiss" | "action", note?: string) {
  const report = await prisma.contentReport.findUnique({
    where: { report_id },
    select: { report_id: true, status: true, target_type: true, target_id: true },
  });
  if (!report) throw ApiError.notFound("Report not found");
  if (report.status !== "open") throw ApiError.conflict("Report already resolved");

  if (action === "action") await applyAction(report.target_type, report.target_id);

  const status: ReportStatus = action === "action" ? "actioned" : "dismissed";
  const where = { target_type: report.target_type, target_id: report.target_id, status: "open" as const };
  const affected = await prisma.contentReport.findMany({ where, select: { reporter_id: true } });

  await prisma.$transaction([
    prisma.contentReport.updateMany({
      where,
      data: { status, admin_note: note || null, resolved_by: admin_id, resolved_at: new Date() },
    }),
    prisma.notification.createMany({
      data: [...new Set(affected.map((a) => a.reporter_id))].map((user_id) => ({
        user_id,
        type: "system" as const,
        content: `ผลการตรวจสอบรายงานของคุณ: ${RESULT_TEXT[action]}`,
      })),
    }),
  ]);

  return { report_id, status, resolved_count: affected.length };
}
