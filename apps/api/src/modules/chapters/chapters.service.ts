import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moveToTrash } from "@/lib/trash";
import { ApiError } from "@/utils/ApiError";
import { assertNovelVisible } from "@/lib/novelVisibility";
import { isViewerAgeVerified } from "@/lib/contentRating";
import type { ChapterStatus } from "@prisma/client";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

/** นับความยาวเนื้อหาเป็นตัวอักษร ไม่ใช่คำ — ภาษาไทยไม่มีช่องว่างระหว่างคำแบบภาษาอังกฤษ
 *  จึง split-by-space นับ "word" ไม่ได้ผล ใช้จำนวนตัวอักษร (ไม่รวม whitespace) แทน */
export function computeWordCount(content?: string | null): number {
  if (!content) return 0;
  return stripHtml(content).replace(/\s+/g, "").length;
}

async function assertNovelOwner(novel_id: string, user_id: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
  return novel;
}

async function getChapterWithNovel(chapter_id: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { chapter_id },
    include: { novel: { select: { author_id: true, visibility: true, content_rating: true } } },
  });
  if (!chapter) throw ApiError.notFound("Chapter not found");
  return chapter;
}

interface CreateChapterInput {
  chapter_number: number;
  title: string;
  content?: string;
  status: ChapterStatus;
  scheduled_publish_at?: Date;
}

/** Reference implementation — POST /novels/:novel_id/chapters
 *  audit fix — chapter_number คำนวณจาก max+1 ฝั่งหน้าเว็บตอนโหลดหน้า ถ้าเปิดหน้า "เขียนตอนใหม่"
 *  สองแท็บ (หรือกดบันทึกซ้อนกันเร็วมาก) พร้อมกันจะชน @@unique([novel_id, chapter_number]) เดิม
 *  ปล่อยให้ P2002 หลุดไปที่ error middleware ทั่วไปซึ่งตอบเป็นข้อความอังกฤษดิบ ("Unique constraint
 *  violation") ทั้งที่ UI ทั้งหน้าเป็นภาษาไทย — จับเป็นข้อความไทยที่เข้าใจง่ายแทน เหมือน pattern
 *  เดิมที่ novels.service.ts createReview ทำไว้ */
export async function createChapter(novel_id: string, author_id: string, input: CreateChapterInput) {
  await assertNovelOwner(novel_id, author_id);

  try {
    const chapter = await prisma.chapter.create({
      data: {
        novel_id,
        chapter_number: input.chapter_number,
        title: input.title,
        content: input.content,
        status: input.status,
        word_count: computeWordCount(input.content),
        published_at: input.status === "published" ? new Date() : null,
        scheduled_publish_at: input.status === "scheduled" ? input.scheduled_publish_at : null,
      },
      select: {
        chapter_id: true,
        chapter_number: true,
        title: true,
        status: true,
        scheduled_publish_at: true,
        created_at: true,
      },
    });

    return chapter;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("มีตอนที่ " + input.chapter_number + " อยู่แล้ว กรุณาโหลดหน้านี้ใหม่แล้วลองอีกครั้ง");
    }
    throw err;
  }
}

/** Reference implementation — GET /novels/:novel_id/chapters (Public — draft เห็นเฉพาะเจ้าของ,
 *  นิยาย private/pending_review ทั้งเรื่องก็เห็นเฉพาะเจ้าของเช่นกัน) */
export async function listNovelChapters(novel_id: string, requester_id?: string) {
  const novel = await prisma.novel.findUnique({
    where: { novel_id },
    select: { author_id: true, visibility: true },
  });
  if (!novel) throw ApiError.notFound("Novel not found");

  const isOwner = assertNovelVisible(novel, requester_id);

  const chapters = await prisma.chapter.findMany({
    where: { novel_id, ...(isOwner ? {} : { status: "published" as ChapterStatus }) },
    select: {
      chapter_id: true,
      chapter_number: true,
      title: true,
      status: true,
      word_count: true,
      published_at: true,
      scheduled_publish_at: true,
      updated_at: true,
    },
    orderBy: { chapter_number: "asc" },
  });

  return { chapters };
}

/** Reference implementation — GET /chapters/:chapter_id (Public — draft เห็นเฉพาะเจ้าของ,
 *  นิยาย private/pending_review ทั้งเรื่องก็เห็นเฉพาะเจ้าของเช่นกัน) */
export async function getChapterById(chapter_id: string, requester_id?: string) {
  const chapter = await getChapterWithNovel(chapter_id);

  const isOwner = assertNovelVisible(chapter.novel, requester_id, "Chapter not found");
  if (chapter.status !== "published" && !isOwner) {
    throw ApiError.notFound("Chapter not found");
  }

  // เพิ่มภายหลัง (Phase H) — เดิมจุดนี้ไม่เช็ค content_rating เลย ทำให้เดา/แชร์ chapter_id ตรง ๆ
  // อ่านเนื้อหาได้แม้หน้ารายละเอียดนิยาย (getNovelById) จะบล็อกไปแล้วก็ตาม ต้องเกตซ้ำที่นี่ด้วย
  if (chapter.novel.content_rating === "mature" && !isOwner && !(await isViewerAgeVerified(requester_id))) {
    throw ApiError.forbidden("ต้องยืนยันอายุ 18 ปีขึ้นไปก่อนถึงจะอ่านตอนนี้ได้", {
      code: "AGE_VERIFICATION_REQUIRED",
    });
  }

  const { novel: _novel, ...rest } = chapter;
  return rest;
}

interface UpdateChapterInput {
  title?: string;
  content?: string;
  status?: ChapterStatus;
  scheduled_publish_at?: Date;
}

export async function updateChapter(chapter_id: string, user_id: string, input: UpdateChapterInput) {
  const chapter = await getChapterWithNovel(chapter_id);
  if (chapter.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const willPublishNow = input.status === "published" && chapter.status !== "published";
  const willSchedule = input.status === "scheduled";

  const updated = await prisma.chapter.update({
    where: { chapter_id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined
        ? { content: input.content, word_count: computeWordCount(input.content) }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(willPublishNow ? { published_at: new Date() } : {}),
      // เคลียร์เวลาตั้งเผยแพร่เดิมทิ้งถ้าเปลี่ยนสถานะไปเป็นอย่างอื่นที่ไม่ใช่ scheduled อีกต่อไป
      scheduled_publish_at: willSchedule ? input.scheduled_publish_at : input.status !== undefined ? null : undefined,
      updated_at: new Date(),
    },
    select: {
      chapter_id: true,
      title: true,
      content: true,
      status: true,
      word_count: true,
      published_at: true,
      scheduled_publish_at: true,
      updated_at: true,
    },
  });

  return updated;
}

/** ย้ายลงถังขยะ (soft delete, 30 วัน) — ไม่ใช่ hard delete */
export async function deleteChapter(chapter_id: string, user_id: string) {
  const chapter = await getChapterWithNovel(chapter_id);
  if (chapter.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const { novel: _novel, ...snapshot } = chapter;

  const trash = await prisma.$transaction(async (tx) => {
    const created = await moveToTrash(tx, {
      novel_id: chapter.novel_id,
      content_type: "chapter",
      content_ref_id: chapter.chapter_id,
      content_snapshot: snapshot,
      deleted_by: user_id,
    });
    await tx.chapter.delete({ where: { chapter_id } });
    return created;
  });

  return trash;
}

/** PATCH /chapters/:chapter_id/autosave — เรียกทุก 30 วิจาก editor ฝั่ง client
 *  audit fix — เดิมรับแค่ content_snapshot ทำให้แก้ "ชื่อตอน" แล้วรอ autosave (ไม่กด "บันทึกร่าง"
 *  เอง) ชื่อจริงในฐานข้อมูลไม่ถูกอัปเดต ทั้งที่ UI ขึ้นสถานะ "บันทึกแล้ว" หลอกผู้ใช้ — เพิ่ม title
 *  (optional) ให้ autosave อัปเดต title ไปพร้อมกันถ้ามีการแก้ไข */
export async function autosaveChapter(
  chapter_id: string,
  user_id: string,
  content_snapshot: string,
  title?: string
) {
  const chapter = await getChapterWithNovel(chapter_id);
  if (chapter.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const latest = await prisma.chapterVersion.findFirst({
    where: { chapter_id },
    orderBy: { version_number: "desc" },
    select: { version_number: true },
  });
  const version_number = (latest?.version_number ?? 0) + 1;

  const [version] = await prisma.$transaction([
    prisma.chapterVersion.create({
      data: { chapter_id, content_snapshot, version_number, edited_by: user_id, is_autosave: true },
      select: { version_id: true, version_number: true, is_autosave: true, created_at: true },
    }),
    prisma.chapter.update({
      where: { chapter_id },
      data: {
        content: content_snapshot,
        word_count: computeWordCount(content_snapshot),
        ...(title !== undefined ? { title } : {}),
        updated_at: new Date(),
      },
    }),
  ]);

  return version;
}

export async function listChapterVersions(chapter_id: string, user_id: string) {
  const chapter = await getChapterWithNovel(chapter_id);
  if (chapter.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const versions = await prisma.chapterVersion.findMany({
    where: { chapter_id },
    orderBy: { version_number: "desc" },
    select: { version_id: true, version_number: true, is_autosave: true, created_at: true },
  });

  return { versions };
}

interface CommentNode {
  comment_id: string;
  user: { user_id: string; username: string; avatar_url: string | null };
  content: string;
  sentiment_label: string | null;
  created_at: Date;
  replies: CommentNode[];
}

/** Reference implementation — GET /chapters/:chapter_id/comments (Public, gated เหมือน getChapterById —
 *  ตอน/นิยายที่ไม่เผยแพร่ไม่ควรให้ใครเห็นคอมเมนต์ได้ก่อนเจ้าของ)
 *  ประกอบ flat rows จาก DB เป็นต้นไม้ replies ตาม parent_comment_id */
export async function listChapterComments(chapter_id: string, requester_id?: string) {
  const chapter = await getChapterWithNovel(chapter_id);
  const isOwner = assertNovelVisible(chapter.novel, requester_id, "Chapter not found");
  if (chapter.status !== "published" && !isOwner) {
    throw ApiError.notFound("Chapter not found");
  }

  const rows = await prisma.comment.findMany({
    where: { chapter_id },
    orderBy: { created_at: "asc" },
    include: { user: { select: { user_id: true, username: true, avatar_url: true } } },
  });

  const nodes = new Map<string, CommentNode>();
  for (const row of rows) {
    nodes.set(row.comment_id, {
      comment_id: row.comment_id,
      user: row.user,
      content: row.content,
      sentiment_label: row.sentiment_label,
      created_at: row.created_at,
      replies: [],
    });
  }

  const roots: CommentNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.comment_id)!;
    const parent = row.parent_comment_id ? nodes.get(row.parent_comment_id) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  return { comments: roots };
}

interface CreateCommentInput {
  content: string;
  parent_comment_id?: string;
}

/** Reference implementation — POST /chapters/:chapter_id/comments
 *  sentiment_label เป็น null เสมอตอน insert — Python NLP Worker จะ UPDATE กลับมาแบบ async ทีหลัง */
export async function createComment(chapter_id: string, user_id: string, input: CreateCommentInput) {
  const chapter = await prisma.chapter.findUnique({ where: { chapter_id }, select: { chapter_id: true } });
  if (!chapter) throw ApiError.notFound("Chapter not found");

  if (input.parent_comment_id) {
    const parent = await prisma.comment.findUnique({
      where: { comment_id: input.parent_comment_id },
      select: { chapter_id: true },
    });
    if (!parent || parent.chapter_id !== chapter_id) {
      throw ApiError.badRequest("Invalid parent_comment_id");
    }
  }

  const comment = await prisma.comment.create({
    data: {
      chapter_id,
      user_id,
      content: input.content,
      parent_comment_id: input.parent_comment_id,
    },
    select: { comment_id: true, content: true, sentiment_label: true, created_at: true },
  });

  return comment;
}

export async function restoreChapterVersion(chapter_id: string, version_id: string, user_id: string) {
  const chapter = await getChapterWithNovel(chapter_id);
  if (chapter.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const version = await prisma.chapterVersion.findUnique({ where: { version_id } });
  if (!version || version.chapter_id !== chapter_id) throw ApiError.notFound("Version not found");

  const updated = await prisma.chapter.update({
    where: { chapter_id },
    data: {
      content: version.content_snapshot,
      word_count: computeWordCount(version.content_snapshot),
      updated_at: new Date(),
    },
    select: { chapter_id: true, content: true, updated_at: true },
  });

  return updated;
}
