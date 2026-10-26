import type { Request, Response } from "express";
import { z } from "zod";
import * as adminService from "@/modules/admin/admin.service";
import * as dashboardService from "@/modules/admin/dashboard.service";
import * as moderationService from "@/modules/admin/moderation.service";
import * as reportsService from "@/modules/reports/reports.service";
import * as recommendationsService from "@/modules/recommendations/recommendations.service";

const novelIdParamSchema = z.object({ novel_id: z.string().uuid() });

const moderationQuerySchema = z.object({
  tab: z.enum(["unreviewed", "reported", "appeals", "suspended"]).default("unreviewed"),
  page: z.coerce.number().int().positive().default(1),
});

/** GET /admin/novels/moderation — คิวตรวจนิยายที่เผยแพร่แล้ว (post-moderation) */
export async function moderationQueue(req: Request, res: Response) {
  const { tab, page } = moderationQuerySchema.parse(req.query);
  res.status(200).json(await moderationService.listModerationQueue(tab, page));
}

const suspendNovelBodySchema = z.object({ reason: z.string().trim().min(10, "ระบุเหตุผลอย่างน้อย 10 ตัวอักษร").max(2000) });

/** PATCH /admin/novels/:novel_id/suspend — ระงับนิยาย (เหตุผลบังคับ) + ปิดรายงานที่ค้างของนิยายเรื่องนี้ */
export async function suspendNovel(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const { reason } = suspendNovelBodySchema.parse(req.body);
  const result = await moderationService.suspendNovel(novel_id, req.user!.user_id, reason);
  await reportsService.closeOpenReportsForTarget("novel", novel_id, req.user!.user_id, "action", reason);
  res.status(200).json(result);
}

export async function markNovelReviewed(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  res.status(200).json(await moderationService.markNovelReviewed(novel_id));
}

const resolveModerationBodySchema = z.object({
  decision: z.enum(["reinstate", "uphold"]),
  note: z.string().trim().max(2000).optional(),
});

/** PATCH /admin/novels/:novel_id/moderation — คืนสถานะ / ยืนยันการระงับหลังอุทธรณ์ */
export async function resolveModeration(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const { decision, note } = resolveModerationBodySchema.parse(req.body);
  res.status(200).json(await moderationService.resolveModerationCase(novel_id, req.user!.user_id, decision, note || undefined));
}

const paginationQuerySchema = z.object({ page: z.coerce.number().int().positive().default(1) });

// ตัวกรองหน้า /admin/users: ทั้งหมด / ผู้ใช้จริง / ตัวอย่าง
const listUsersQuerySchema = paginationQuerySchema.extend({ type: z.enum(["all", "real", "demo"]).default("all") });
const ACCOUNT_TYPE_FILTER = { all: undefined, real: "REAL", demo: "DEMO" } as const;

export async function listUsers(req: Request, res: Response) {
  const { page, type } = listUsersQuerySchema.parse(req.query);
  const result = await adminService.listUsers(page, ACCOUNT_TYPE_FILTER[type]);
  res.status(200).json(result);
}

const userIdParamSchema = z.object({ user_id: z.string().uuid() });
const updateUserRoleBodySchema = z.object({ role: z.enum(["admin", "user"]) });

export async function updateUserRole(req: Request, res: Response) {
  const { user_id } = userIdParamSchema.parse(req.params);
  const { role } = updateUserRoleBodySchema.parse(req.body);
  const result = await adminService.updateUserRole(user_id, role);
  res.status(200).json(result);
}

export async function suspendUser(req: Request, res: Response) {
  const { user_id } = userIdParamSchema.parse(req.params);
  const result = await adminService.suspendUser(user_id);
  res.status(200).json(result);
}

export async function unsuspendUser(req: Request, res: Response) {
  const { user_id } = userIdParamSchema.parse(req.params);
  const result = await adminService.unsuspendUser(user_id);
  res.status(200).json(result);
}

export async function listTags(_req: Request, res: Response) {
  const result = await adminService.listTags();
  res.status(200).json(result);
}

// audit fix — เดิมขาด "pairing"/"freeform" ทั้งที่ TagCategory enum (schema.prisma) ตั้งใจให้ทั้งคู่
// เป็น admin-curated preset (มีแค่ "fandom" เท่านั้นที่ตั้งใจให้ไม่มี admin preset — สร้างผ่านหน้า
// เขียนนิยาย free-type เท่านั้น ดู novels.service.ts resolveTagNames) — แก้ให้ตรงกับ MASTER BRIEF
// ที่ pairing/freeform ต้องจัดการผ่านหน้า admin ได้จริง ไม่ใช่แค่มี category ในฐานข้อมูลเฉย ๆ
const tagCategoryEnum = z.enum(["genre", "mood", "pairing", "freeform", "theme"]);
const createTagBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  category: tagCategoryEnum.optional(),
});

export async function createTag(req: Request, res: Response) {
  const body = createTagBodySchema.parse(req.body);
  const result = await adminService.createTag(body.name, body.category);
  res.status(201).json(result);
}

const tagIdParamSchema = z.object({ tag_id: z.coerce.number().int().positive() });
const updateTagBodySchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    category: tagCategoryEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export async function updateTag(req: Request, res: Response) {
  const { tag_id } = tagIdParamSchema.parse(req.params);
  const body = updateTagBodySchema.parse(req.body);
  const result = await adminService.updateTag(tag_id, body);
  res.status(200).json(result);
}

export async function deleteTag(req: Request, res: Response) {
  const { tag_id } = tagIdParamSchema.parse(req.params);
  await adminService.deleteTag(tag_id);
  res.status(204).send();
}

export async function stats(_req: Request, res: Response) {
  const result = await adminService.getStats();
  res.status(200).json(result);
}

/** GET /admin/reports/activity — เติมเหรียญ/ส่งของขวัญล่าสุด (hero หน้าภาพรวมหลังบ้าน) */
export async function recentActivity(_req: Request, res: Response) {
  res.status(200).json(await adminService.getRecentActivity());
}

/** GET /admin/reports/sentiment — ความรู้สึกผู้อ่านทั้งแพลตฟอร์ม รวมฝั่งลบที่ไม่แสดงให้นักเขียน */
export async function sentimentOverview(_req: Request, res: Response) {
  res.status(200).json(await adminService.getSentimentOverview());
}

/** GET /admin/dashboard — ข้อมูลหน้าภาพรวม (bento) ทั้งหมดใน request เดียว */
export async function dashboard(_req: Request, res: Response) {
  res.status(200).json(await dashboardService.getDashboard());
}

// ปุ่ม "สร้างความสัมพันธ์ผู้ใช้ใหม่" — full resync ใช้เวลานานเกิน timeout ของ gateway จึงรันเบื้องหลัง
// แล้วให้หน้าเว็บถามสถานะผ่าน GET เดียวกัน (กดซ้ำระหว่างรันไม่เริ่มรอบใหม่)
let resyncRun: Promise<unknown> | null = null;
let resyncError: string | null = null;

function resyncStatus() {
  return {
    // รวมรอบที่ scheduler/heal เริ่มเองด้วย ไม่ใช่แค่รอบที่กดจากหน้านี้
    running: recommendationsService.isFullResyncRunning(),
    error: resyncError,
    updatedAt: recommendationsService.getLastFullResyncAt()?.toISOString() ?? null,
  };
}

/** POST /admin/recommendations/resync — เริ่ม full resync กราฟ Neo4j (202 ทันที) */
export async function resyncRecommendations(_req: Request, res: Response) {
  if (!resyncRun) {
    resyncError = null;
    resyncRun = recommendationsService
      .fullResync()
      .catch((err: unknown) => {
        resyncError = err instanceof Error ? err.message : String(err);
        console.error("[admin] recommendations resync failed", err);
      })
      .finally(() => {
        resyncRun = null;
      });
  }
  res.status(202).json(resyncStatus());
}

/** GET /admin/recommendations/resync — สถานะรอบ resync */
export async function resyncRecommendationsStatus(_req: Request, res: Response) {
  res.status(200).json(resyncStatus());
}
