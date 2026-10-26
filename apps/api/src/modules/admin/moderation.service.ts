import type { ModerationCaseStatus, Prisma, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { isDeliverableEmail, isEmailConfigured, sendNovelModerationEmail } from "@/lib/email";
import { ApiError } from "@/utils/ApiError";

/**
 * Post-moderation — นิยายที่นักเขียนกดเผยแพร่ขึ้นให้ผู้อ่านเห็นทันที (ไม่มีคิวอนุมัติก่อนแล้ว)
 * แอดมินสุ่มตรวจ/ตรวจตามรายงานทีหลังที่ /admin/novels แล้ว "ระงับ" ได้พร้อมเหตุผลบังคับ
 *   ระงับ → novels.visibility = suspended + เคสใหม่ใน novel_moderation_cases + แจ้งนักเขียนทั้งในเว็บและอีเมล
 *   นักเขียนยื่นอุทธรณ์ (POST /novels/:id/appeal) → appeal_pending → แอดมินคืนสถานะ หรือยืนยันการระงับ
 */

export type ModerationTab = "unreviewed" | "reported" | "appeals" | "suspended";

/** เคสที่ยังมีผลอยู่ (นิยายยังถูกระงับ) — reinstated คือปิดเคสแล้ว */
const OPEN_CASE_STATUSES: ModerationCaseStatus[] = ["suspended", "appeal_pending", "upheld"];

const caseSelect = {
  case_id: true,
  status: true,
  reason: true,
  created_at: true,
  appeal_message: true,
  appealed_at: true,
  appeal_count: true,
  resolution_note: true,
  resolved_at: true,
} satisfies Prisma.NovelModerationCaseSelect;

export type ModerationCaseSummary = Prisma.NovelModerationCaseGetPayload<{ select: typeof caseSelect }>;

/** ลิงก์หน้าจัดการนิยายของนักเขียนที่เปิดฟอร์มอุทธรณ์ให้ทันที */
export function appealPath(novel_id: string) {
  return `/write/${novel_id}?appeal=1`;
}

/** นิยายที่ "ยังไม่ได้ตรวจ" = เผยแพร่อยู่ และไม่เคยตรวจ หรือแก้ไขหลังตรวจครั้งล่าสุด */
function unreviewedWhere(): Prisma.NovelWhereInput {
  return {
    visibility: "published",
    deleted_at: null,
    OR: [
      { moderation_reviewed_at: null },
      { updated_at: { gt: prisma.novel.fields.moderation_reviewed_at } },
    ],
  };
}

async function openNovelReportCounts(): Promise<Map<string, number>> {
  const rows = await prisma.contentReport.groupBy({
    by: ["target_id"],
    where: { target_type: "novel", status: "open" },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.target_id, r._count._all]));
}

/** ตัวเลขบนแท็บคิวตรวจ + badge เมนูหลังบ้าน */
export async function getQueueCounts() {
  const reportCounts = await openNovelReportCounts();
  const [unreviewed, reported, appeals, suspended] = await Promise.all([
    prisma.novel.count({ where: unreviewedWhere() }),
    reportCounts.size
      ? prisma.novel.count({ where: { novel_id: { in: [...reportCounts.keys()] }, deleted_at: null } })
      : Promise.resolve(0),
    prisma.novelModerationCase.count({ where: { status: "appeal_pending", novel: { deleted_at: null } } }),
    prisma.novel.count({ where: { visibility: "suspended", deleted_at: null } }),
  ]);
  return { unreviewed, reported, appeals, suspended };
}

/** GET /admin/novels/moderation?tab=&page= — คิวตรวจนิยายที่เผยแพร่แล้ว */
export async function listModerationQueue(tab: ModerationTab, page: number, pageSize = 20) {
  const reportCounts = await openNovelReportCounts();

  let where: Prisma.NovelWhereInput;
  let orderBy: Prisma.NovelOrderByWithRelationInput[];
  switch (tab) {
    case "unreviewed":
      where = unreviewedWhere();
      orderBy = [{ created_at: "desc" }];
      break;
    case "reported":
      where = { novel_id: { in: [...reportCounts.keys()] }, deleted_at: null };
      orderBy = [{ created_at: "desc" }];
      break;
    case "appeals":
      where = { deleted_at: null, moderation_cases: { some: { status: "appeal_pending" } } };
      orderBy = [{ updated_at: { sort: "asc", nulls: "first" } }];
      break;
    case "suspended":
      where = { visibility: "suspended", deleted_at: null };
      orderBy = [{ updated_at: { sort: "desc", nulls: "last" } }];
      break;
  }

  const [rows, total] = await Promise.all([
    prisma.novel.findMany({
      where,
      orderBy,
      // แท็บรายงาน: เรียงตามจำนวนรายงานในหน่วยความจำ (ชุดเล็ก — นับเฉพาะนิยายที่มีรายงานเปิดอยู่)
      ...(tab === "reported" ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      select: {
        novel_id: true,
        title: true,
        synopsis: true,
        cover_image_url: true,
        legal_status: true,
        content_rating: true,
        visibility: true,
        created_at: true,
        updated_at: true,
        moderation_reviewed_at: true,
        author: { select: { user_id: true, username: true, pen_name: true } },
        _count: { select: { chapters: { where: { status: "published" } } } },
        moderation_cases: { orderBy: { created_at: "desc" }, take: 1, select: caseSelect },
      },
    }),
    prisma.novel.count({ where }),
  ]);

  let novels = rows.map(({ _count, moderation_cases, ...n }) => ({
    ...n,
    published_chapter_count: _count.chapters,
    open_report_count: reportCounts.get(n.novel_id) ?? 0,
    moderation_case: moderation_cases[0] && OPEN_CASE_STATUSES.includes(moderation_cases[0].status) ? moderation_cases[0] : null,
  }));

  if (tab === "reported") {
    novels.sort((a, b) => b.open_report_count - a.open_report_count);
    novels = novels.slice((page - 1) * pageSize, page * pageSize);
  }
  if (tab === "appeals") {
    novels.sort((a, b) => (a.moderation_case?.appealed_at?.getTime() ?? 0) - (b.moderation_case?.appealed_at?.getTime() ?? 0));
  }

  return { tab, novels, total, page, pageSize, counts: await getQueueCounts() };
}

interface NotifyInput {
  kind: "suspended" | "reinstated" | "upheld";
  novel_id: string;
  title: string;
  author_id: string;
  author_email: string | null;
  reason: string;
  note?: string | null;
}

const NOTIFICATION_TEXT: Record<NotifyInput["kind"], (i: NotifyInput) => string> = {
  suspended: (i) =>
    `นิยาย "${i.title}" ถูกระงับการเผยแพร่ เหตุผล: ${i.reason} — แก้ไขเนื้อหาแล้วกด "ยื่นอุทธรณ์" ที่หน้าจัดการนิยายเพื่อขอให้ทีมงานตรวจซ้ำ`,
  reinstated: (i) => `นิยาย "${i.title}" ผ่านการตรวจสอบซ้ำและกลับมาเผยแพร่แล้ว${i.note ? ` หมายเหตุ: ${i.note}` : ""}`,
  upheld: (i) =>
    `คำอุทธรณ์ของนิยาย "${i.title}" ไม่ผ่าน ยังคงระงับการเผยแพร่${i.note ? ` ผลการพิจารณา: ${i.note}` : ""} — แก้ไขแล้วยื่นอุทธรณ์ใหม่ได้`,
};

/** แจ้งเตือนในเว็บถูกสร้างใน transaction เดียวกับการเปลี่ยนสถานะ (ดู caller) — ตรงนี้ส่งอีเมล
 *  ส่งไม่สำเร็จไม่ทำให้การระงับล้ม (แจ้งเตือนในเว็บถึงแล้ว) แค่คืน false ให้แอดมินเห็น */
async function sendModerationEmail(input: NotifyInput): Promise<boolean> {
  if (!isEmailConfigured() || !isDeliverableEmail(input.author_email)) return false;
  try {
    await sendNovelModerationEmail(input.author_email, {
      kind: input.kind,
      novelTitle: input.title,
      reason: input.reason,
      note: input.note,
      appealUrl: `${env.APP_URL.replace(/\/$/, "")}${input.kind === "reinstated" ? `/write/${input.novel_id}` : appealPath(input.novel_id)}`,
    });
    return true;
  } catch (err) {
    console.error(`[moderation] email to author of novel ${input.novel_id} failed:`, err);
    return false;
  }
}

function notificationData(input: NotifyInput): Prisma.NotificationCreateManyInput {
  return {
    user_id: input.author_id,
    type: "moderation",
    content: NOTIFICATION_TEXT[input.kind](input),
    link_url: input.kind === "reinstated" ? `/write/${input.novel_id}` : appealPath(input.novel_id),
  };
}

/** PATCH /admin/novels/:novel_id/suspend — ระงับ (take down) นิยาย เหตุผลบังคับ
 *  skipIfSuspended: ใช้จากการจัดการรายงานเนื้อหา — นิยายที่ระงับอยู่แล้วไม่ต้องเปิดเคสซ้ำ */
export async function suspendNovel(
  novel_id: string,
  admin_id: string,
  reason: string,
  opts: { skipIfSuspended?: boolean } = {}
) {
  const result = await prisma.$transaction(async (tx) => {
    // ล็อกแถวนิยายกันแอดมินสองคนกดระงับพร้อมกันจนเกิดสองเคส / นักเขียนเปลี่ยน visibility แทรกกลางทาง
    const locked = await tx.$queryRaw<{ visibility: Visibility }[]>`
      SELECT visibility FROM novels WHERE novel_id = ${novel_id}::uuid FOR UPDATE`;
    if (!locked.length) throw ApiError.notFound("Novel not found");

    const novel = await tx.novel.findUniqueOrThrow({
      where: { novel_id },
      select: {
        title: true,
        author_id: true,
        visibility: true,
        deleted_at: true,
        visibility_before_delete: true,
        author: { select: { email: true } },
      },
    });
    const current = novel.deleted_at ? novel.visibility_before_delete ?? "private" : novel.visibility;
    if (current === "suspended") {
      if (opts.skipIfSuspended) return null;
      throw ApiError.conflict("นิยายเรื่องนี้ถูกระงับอยู่แล้ว");
    }

    const now = new Date();
    const moderationCase = await tx.novelModerationCase.create({
      data: { novel_id, reason, visibility_before_suspend: current, suspended_by: admin_id },
      select: caseSelect,
    });
    await tx.novel.update({
      where: { novel_id },
      // นิยายในถังขยะยังเป็น private อยู่ — ระงับค่าที่จะกู้คืนกลับแทน (กู้คืนแล้วต้องยังถูกระงับ)
      data: novel.deleted_at
        ? { visibility_before_delete: "suspended", moderation_reviewed_at: now }
        : { visibility: "suspended", moderation_reviewed_at: now },
    });

    const notify: NotifyInput = {
      kind: "suspended",
      novel_id,
      title: novel.title,
      author_id: novel.author_id,
      author_email: novel.author.email,
      reason,
    };
    await tx.notification.create({ data: notificationData(notify) });
    return { moderationCase, notify };
  });

  if (!result) return null;
  const email_sent = await sendModerationEmail(result.notify);
  return {
    novel_id,
    visibility: "suspended" as const,
    moderation_case: result.moderationCase,
    notified: { web: true, email: email_sent },
  };
}

/** PATCH /admin/novels/:novel_id/reviewed — สุ่มตรวจแล้วไม่พบปัญหา เอาออกจากแท็บ "ยังไม่ตรวจ" */
export async function markNovelReviewed(novel_id: string) {
  const res = await prisma.novel.updateMany({
    where: { novel_id, deleted_at: null },
    data: { moderation_reviewed_at: new Date() },
  });
  if (!res.count) throw ApiError.notFound("Novel not found");
  return { novel_id, reviewed: true };
}

/** PATCH /admin/novels/:novel_id/moderation — ตัดสินเคสที่ยังเปิดอยู่
 *  reinstate = คืนสถานะเดิมก่อนระงับ (ทำได้ทั้งตอนรออุทธรณ์ หรือยกเลิกการระงับเองโดยไม่มีอุทธรณ์)
 *  uphold = ยืนยันการระงับหลังพิจารณาอุทธรณ์ (ต้องมีคำอุทธรณ์รออยู่ และต้องให้เหตุผลกับนักเขียน) */
export async function resolveModerationCase(
  novel_id: string,
  admin_id: string,
  decision: "reinstate" | "uphold",
  note?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ novel_id: string }[]>`
      SELECT novel_id FROM novels WHERE novel_id = ${novel_id}::uuid FOR UPDATE`;
    if (!locked.length) throw ApiError.notFound("Novel not found");

    const novel = await tx.novel.findUniqueOrThrow({
      where: { novel_id },
      select: {
        title: true,
        author_id: true,
        deleted_at: true,
        author: { select: { email: true } },
        moderation_cases: {
          where: { status: { in: OPEN_CASE_STATUSES } },
          orderBy: { created_at: "desc" },
          take: 1,
          select: { case_id: true, status: true, reason: true, visibility_before_suspend: true },
        },
      },
    });
    const open = novel.moderation_cases[0];
    if (!open) throw ApiError.conflict("นิยายเรื่องนี้ไม่ได้ถูกระงับอยู่");
    if (decision === "uphold") {
      if (open.status !== "appeal_pending") throw ApiError.conflict("ไม่มีคำอุทธรณ์ที่รอพิจารณา");
      if (!note) throw ApiError.badRequest("ต้องระบุผลการพิจารณาให้นักเขียนทราบ");
    }

    const now = new Date();
    const moderationCase = await tx.novelModerationCase.update({
      where: { case_id: open.case_id },
      data: {
        status: decision === "reinstate" ? "reinstated" : "upheld",
        resolution_note: note || null,
        resolved_by: admin_id,
        resolved_at: now,
      },
      select: caseSelect,
    });

    let visibility: Visibility = "suspended";
    if (decision === "reinstate") {
      visibility = open.visibility_before_suspend;
      await tx.novel.update({
        where: { novel_id },
        data: novel.deleted_at
          ? { visibility_before_delete: visibility, moderation_reviewed_at: now }
          : { visibility, moderation_reviewed_at: now },
      });
    }

    const notify: NotifyInput = {
      kind: decision === "reinstate" ? "reinstated" : "upheld",
      novel_id,
      title: novel.title,
      author_id: novel.author_id,
      author_email: novel.author.email,
      reason: open.reason,
      note,
    };
    await tx.notification.create({ data: notificationData(notify) });
    return { moderationCase, notify, visibility: novel.deleted_at ? ("private" as const) : visibility };
  });

  const email_sent = await sendModerationEmail(result.notify);
  return {
    novel_id,
    visibility: result.visibility,
    moderation_case: result.moderationCase,
    notified: { web: true, email: email_sent },
  };
}

/** POST /novels/:novel_id/appeal — นักเขียนยื่นอุทธรณ์/ขอให้ตรวจซ้ำ ส่งนิยายกลับเข้าคิวแอดมิน (แท็บ "อุทธรณ์") */
export async function appealSuspension(novel_id: string, user_id: string, message: string) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ author_id: string }[]>`
      SELECT author_id FROM novels WHERE novel_id = ${novel_id}::uuid FOR UPDATE`;
    if (!locked.length) throw ApiError.notFound("Novel not found");
    if (locked[0].author_id !== user_id) throw ApiError.forbidden("Forbidden");

    const open = await tx.novelModerationCase.findFirst({
      where: { novel_id, status: { in: OPEN_CASE_STATUSES } },
      orderBy: { created_at: "desc" },
      select: { case_id: true, status: true },
    });
    if (!open) throw ApiError.conflict("นิยายเรื่องนี้ไม่ได้ถูกระงับ");
    if (open.status === "appeal_pending") throw ApiError.conflict("ส่งคำอุทธรณ์ไปแล้ว รอทีมงานพิจารณา");

    const moderationCase = await tx.novelModerationCase.update({
      where: { case_id: open.case_id },
      data: {
        status: "appeal_pending",
        appeal_message: message,
        appealed_at: new Date(),
        appeal_count: { increment: 1 },
        // อุทธรณ์ใหม่หลังถูกยืนยันการระงับ — ล้างผลรอบก่อน ให้แอดมินพิจารณาใหม่
        resolution_note: null,
        resolved_by: null,
        resolved_at: null,
      },
      select: caseSelect,
    });
    return { novel_id, moderation_case: moderationCase };
  });
}

/** เคสระงับที่ยังมีผลของนิยายแต่ละเรื่อง — ใช้แสดงเหตุผล/สถานะอุทธรณ์ให้เจ้าของนิยายเห็น */
export async function getOpenCasesForNovels(novel_ids: string[]): Promise<Map<string, ModerationCaseSummary>> {
  if (!novel_ids.length) return new Map();
  const cases = await prisma.novelModerationCase.findMany({
    where: { novel_id: { in: novel_ids }, status: { in: OPEN_CASE_STATUSES } },
    orderBy: { created_at: "desc" },
    select: { ...caseSelect, novel_id: true },
  });
  const map = new Map<string, ModerationCaseSummary>();
  for (const { novel_id, ...c } of cases) if (!map.has(novel_id)) map.set(novel_id, c);
  return map;
}
