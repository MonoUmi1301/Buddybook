import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { displayName } from "@/modules/gifts/gifts.service";

/**
 * เพิ่มภายหลัง (ติดตามนักเขียน) — ผู้ติดตามได้แจ้งเตือนตอนใหม่ของทุกเรื่องของนักเขียน
 * (ดู lib/chapterNotifications.ts) และนักเขียนได้แจ้งเตือนเมื่อมีผู้ติดตามใหม่
 */

async function assertFollowableAuthor(author_id: string) {
  const author = await prisma.user.findUnique({
    where: { user_id: author_id },
    select: { user_id: true, is_suspended: true },
  });
  if (!author || author.is_suspended) throw ApiError.notFound("User not found");
}

export async function followAuthor(follower_id: string, author_id: string) {
  if (follower_id === author_id) throw ApiError.unprocessable("You cannot follow yourself");
  await assertFollowableAuthor(author_id);

  try {
    await prisma.authorFollow.create({ data: { follower_id, author_id } });
  } catch (err) {
    // ติดตามอยู่แล้ว — idempotent ไม่ต้องแจ้งเตือนซ้ำ
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return getFollowStatus(author_id, follower_id);
    }
    throw err;
  }

  const follower = await prisma.user.findUnique({
    where: { user_id: follower_id },
    select: { username: true, pen_name: true },
  });
  if (follower) {
    await prisma.notification.create({
      data: {
        user_id: author_id,
        type: "new_follower",
        content: `${displayName(follower)} เริ่มติดตามคุณแล้ว`,
        link_url: `/profile/${follower_id}`,
      },
    });
  }

  return getFollowStatus(author_id, follower_id);
}

export async function unfollowAuthor(follower_id: string, author_id: string) {
  await prisma.authorFollow.deleteMany({ where: { follower_id, author_id } });
  return getFollowStatus(author_id, follower_id);
}

export async function getFollowStatus(author_id: string, viewer_id?: string) {
  const [follower_count, following] = await Promise.all([
    prisma.authorFollow.count({ where: { author_id } }),
    viewer_id && viewer_id !== author_id
      ? prisma.authorFollow
          .findUnique({ where: { follower_id_author_id: { follower_id: viewer_id, author_id } } })
          .then(Boolean)
      : Promise.resolve(false),
  ]);
  return { author_id, follower_count, following };
}

/** GET /users/me/following — นักเขียนที่ติดตามอยู่ ใหม่สุดก่อน */
export async function listFollowing(follower_id: string) {
  const rows = await prisma.authorFollow.findMany({
    where: { follower_id },
    orderBy: { created_at: "desc" },
    select: {
      created_at: true,
      author: { select: { user_id: true, username: true, pen_name: true, avatar_url: true } },
    },
  });
  return { following: rows.map((r) => ({ ...r.author, followed_at: r.created_at })) };
}
