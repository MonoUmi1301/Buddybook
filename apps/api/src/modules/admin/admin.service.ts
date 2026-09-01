import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import type { TagCategory, UserRole } from "@prisma/client";

/** Reference implementation — GET /admin/novels/pending */
export async function listPendingNovels() {
  const novels = await prisma.novel.findMany({
    where: { visibility: "pending_review" },
    orderBy: { created_at: "asc" },
    select: {
      novel_id: true,
      title: true,
      legal_status: true,
      cover_image_url: true,
      author: { select: { user_id: true, username: true } },
    },
  });
  return { novels };
}

/** Reference implementation — PATCH /admin/novels/:novel_id/approve */
export async function approveNovel(novel_id: string) {
  const novel = await prisma.novel.update({
    where: { novel_id },
    data: { visibility: "published" },
    select: { novel_id: true, visibility: true, author_id: true, title: true },
  });

  await prisma.notification.create({
    data: {
      user_id: novel.author_id,
      type: "system",
      content: `นิยาย "${novel.title}" ของคุณผ่านการตรวจสอบและเผยแพร่แล้ว`,
      link_url: `/novels/${novel_id}`,
    },
  });

  return { novel_id: novel.novel_id, visibility: novel.visibility };
}

/** Reference implementation — PATCH /admin/novels/:novel_id/reject */
export async function rejectNovel(novel_id: string, reason: string) {
  const existing = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true, title: true } });
  if (!existing) throw ApiError.notFound("Novel not found");

  const novel = await prisma.novel.update({
    where: { novel_id },
    data: { visibility: "private" },
    select: { novel_id: true, visibility: true },
  });

  await prisma.notification.create({
    data: {
      user_id: existing.author_id,
      type: "system",
      content: `นิยาย "${existing.title}" ของคุณไม่ผ่านการตรวจสอบ: ${reason}`,
      link_url: `/novels/${novel_id}`,
    },
  });

  return { novel_id: novel.novel_id, visibility: novel.visibility, reason };
}

/** Reference implementation — GET /admin/users?page= */
export async function listUsers(page: number, pageSize = 20) {
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        user_id: true,
        username: true,
        email: true,
        role: true,
        is_suspended: true,
        created_at: true,
      },
    }),
    prisma.user.count(),
  ]);
  return { users, total };
}

/** Reference implementation — PATCH /admin/users/:user_id/role */
export async function updateUserRole(user_id: string, role: UserRole) {
  const user = await prisma.user.update({
    where: { user_id },
    data: { role },
    select: { user_id: true, role: true },
  });
  return user;
}

/** Reference implementation — PATCH /admin/users/:user_id/suspend
 *  บล็อกที่ login เท่านั้น (ดู auth.service.ts loginUser) — ไม่เช็คทุก request ผ่าน requireAuth
 *  เพื่อไม่ให้เพิ่ม query ในทุก endpoint (access token อายุสั้น 15 นาทีอยู่แล้ว) */
export async function suspendUser(user_id: string) {
  const user = await prisma.user.update({
    where: { user_id },
    data: { is_suspended: true },
    select: { user_id: true, is_suspended: true },
  });
  return { user_id: user.user_id, suspended: user.is_suspended };
}

/** Reference implementation — GET /admin/tags (Public) */
export async function listTags() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return { tags };
}

/** Reference implementation — POST /admin/tags */
export async function createTag(name: string, category?: TagCategory) {
  try {
    const tag = await prisma.tag.create({
      data: { name, category },
      select: { tag_id: true, name: true, category: true },
    });
    return tag;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("Tag name already exists");
    }
    throw err;
  }
}

interface UpdateTagInput {
  name?: string;
  category?: TagCategory;
}

/** Reference implementation — PATCH /admin/tags/:tag_id */
export async function updateTag(tag_id: number, input: UpdateTagInput) {
  try {
    const tag = await prisma.tag.update({
      where: { tag_id },
      data: input,
      select: { tag_id: true, name: true, category: true },
    });
    return tag;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("Tag name already exists");
    }
    throw err;
  }
}

/** Reference implementation — DELETE /admin/tags/:tag_id (cascade ลบ novel_tags/user_interests
 *  ที่ผูกกับแท็กนี้ไปด้วย ตาม onDelete: Cascade ใน schema.prisma) */
export async function deleteTag(tag_id: number) {
  await prisma.tag.delete({ where: { tag_id } });
}

/** Reference implementation — GET /admin/reports/stats */
export async function getStats() {
  const [total_users, total_novels, total_chapters, pending_review_count] = await Promise.all([
    prisma.user.count(),
    prisma.novel.count(),
    prisma.chapter.count(),
    prisma.novel.count({ where: { visibility: "pending_review" } }),
  ]);
  return { total_users, total_novels, total_chapters, pending_review_count };
}
