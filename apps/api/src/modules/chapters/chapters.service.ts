import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moveToTrash } from "@/lib/trash";
import { ApiError } from "@/utils/ApiError";
import { assertNovelVisible } from "@/lib/novelVisibility";
import { isViewerAgeVerified } from "@/lib/contentRating";
import { notifyLibraryOfNewChapter } from "@/lib/chapterNotifications";
import { syncReadEdge } from "@/lib/graphSync";
import { recordChapterView } from "@/lib/viewTracking";
import type { ChapterStatus } from "@prisma/client";
import { env } from "@/config/env";
import { getBalance, ledgerTimestamp, lockWallets, WALLET_TX_OPTIONS } from "@/modules/wallet/wallet.service";
import { splitGiftFee } from "@/modules/gifts/gift-fee";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

/** นับความยาวเนื้อหาเป็นตัวอักษร ไม่ใช่คำ — ภาษาไทยไม่มีช่องว่างระหว่างคำแบบภาษาอังกฤษ
 *  จึง split-by-space นับ "word" ไม่ได้ผล ใช้จำนวนตัวอักษร (ไม่รวม whitespace) แทน */
export function computeWordCount(content?: string | null): number {
  if (!content) return 0;
  return stripHtml(content).replace(/\s+/g, "").length;
}

const TEASER_MAX_CHARS = 200;
const HTML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/** เพิ่มภายหลัง (ตอนติดเหรียญ) — ตัวอย่างสั้น ๆ ของตอนที่ยังไม่ได้ซื้อ เป็น plain text (ไม่ใช่ HTML)
 *  ตัดที่ช่องว่างใกล้ TEASER_MAX_CHARS ที่สุดถ้ามี กันตัดกลางคำภาษาอังกฤษ */
export function buildTeaser(content?: string | null): string {
  if (!content) return "";
  const text = stripHtml(content)
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_m, name: string) => HTML_ENTITIES[name])
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= TEASER_MAX_CHARS) return text;
  const cut = text.slice(0, TEASER_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > TEASER_MAX_CHARS / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
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
  price_coins?: number;
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
        price_coins: input.price_coins ?? 0,
      },
      select: {
        chapter_id: true,
        chapter_number: true,
        title: true,
        status: true,
        scheduled_publish_at: true,
        price_coins: true,
        created_at: true,
      },
    });

    if (chapter.status === "published") {
      await notifyLibraryOfNewChapter(novel_id, author_id, chapter);
    }

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
      price_coins: true,
    },
    orderBy: { chapter_number: "asc" },
  });

  // เพิ่มภายหลัง (ตอนติดเหรียญ) — is_unlocked บอกหน้าเว็บว่าตอนไหนอ่านได้เลย (ฟรี/ซื้อแล้ว/เป็นเจ้าของ)
  const paidIds = chapters.filter((c) => c.price_coins > 0).map((c) => c.chapter_id);
  const owned =
    requester_id && !isOwner && paidIds.length
      ? new Set(
          (
            await prisma.chapterPurchase.findMany({
              where: { user_id: requester_id, chapter_id: { in: paidIds } },
              select: { chapter_id: true },
            })
          ).map((p) => p.chapter_id)
        )
      : new Set<string>();

  return {
    chapters: chapters.map((c) => ({
      ...c,
      is_unlocked: isOwner || c.price_coins === 0 || owned.has(c.chapter_id),
    })),
  };
}

/** Reference implementation — GET /chapters/:chapter_id (Public — draft เห็นเฉพาะเจ้าของ,
 *  นิยาย private/pending_review ทั้งเรื่องก็เห็นเฉพาะเจ้าของเช่นกัน) */
export async function getChapterById(chapter_id: string, requester_id?: string, viewer_key?: string) {
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

  // เพิ่มภายหลัง (ตอนติดเหรียญ) — ยังไม่ได้ซื้อ: ส่งข้อมูลตอนกลับไปได้ (ชื่อ/ราคา) แต่ไม่ส่งเนื้อหา
  const locked = chapter.price_coins > 0 && !isOwner && !(await hasPurchased(requester_id, chapter_id));
  if (locked) {
    const { novel: _n, content, ...meta } = chapter;
    return { ...meta, content: null, teaser: buildTeaser(content), locked: true };
  }

  // gap 3.1 — นับยอดวิว (ทั้งผู้อ่านที่ล็อกอินและไม่ล็อกอิน) ไม่นับเจ้าของ/ตอนที่ยังล็อกอยู่
  const viewer = requester_id ?? viewer_key;
  if (viewer && !isOwner && chapter.status === "published") {
    recordChapterView(chapter.chapter_id, chapter.novel_id, viewer).catch((err) =>
      console.error("recordChapterView failed:", err)
    );
  }

  if (requester_id && !isOwner && chapter.status === "published") {
    recordReadingProgress(requester_id, chapter.novel_id, chapter.chapter_id, chapter.chapter_number).catch((err) =>
      console.error("recordReadingProgress failed:", err)
    );
  }

  const { novel: _novel, ...rest } = chapter;
  return { ...rest, teaser: null, locked: false };
}

async function hasPurchased(user_id: string | undefined, chapter_id: string) {
  if (!user_id) return false;
  const row = await prisma.chapterPurchase.findUnique({
    where: { user_id_chapter_id: { user_id, chapter_id } },
    select: { purchase_id: true },
  });
  return Boolean(row);
}

/** เพิ่มภายหลัง (ตอนติดเหรียญ) — POST /chapters/:chapter_id/purchase
 *  หัก coin ผู้อ่าน → เข้ากระเป๋านักเขียนหลังหักค่าธรรมเนียม (CHAPTER_PLATFORM_FEE_PERCENT) ใน transaction
 *  เดียวกับ lockWallets (pattern เดียวกับ gifts.service.ts sendGift) — ซื้อซ้ำ = idempotent คืนรายการเดิม
 *  ตอบกลับพร้อม content ของตอน (ผู้ซื้อมีสิทธิ์อ่านแล้ว) */
export async function purchaseChapter(user_id: string, chapter_id: string) {
  const chapter = await getChapterWithNovel(chapter_id);
  const isOwner = assertNovelVisible(chapter.novel, user_id, "Chapter not found");
  if (chapter.status !== "published") throw ApiError.notFound("Chapter not found");
  if (isOwner) throw ApiError.unprocessable("You already own this chapter");
  if (chapter.price_coins <= 0) throw ApiError.unprocessable("This chapter is free");
  if (chapter.novel.content_rating === "mature" && !(await isViewerAgeVerified(user_id))) {
    throw ApiError.forbidden("ต้องยืนยันอายุ 18 ปีขึ้นไปก่อนถึงจะอ่านตอนนี้ได้", {
      code: "AGE_VERIFICATION_REQUIRED",
    });
  }

  const author_id = chapter.novel.author_id;
  const price = chapter.price_coins;
  const { fee, net } = splitGiftFee(price, env.CHAPTER_PLATFORM_FEE_PERCENT);

  return prisma.$transaction(async (tx) => {
    await lockWallets(tx, [user_id, author_id]);

    const existing = await tx.chapterPurchase.findUnique({
      where: { user_id_chapter_id: { user_id, chapter_id } },
      select: { purchase_id: true, price_coins: true, created_at: true },
    });
    if (existing) {
      return {
        ...existing,
        chapter_id,
        balance_after: await getBalance(user_id, tx),
        already_owned: true,
        content: chapter.content,
      };
    }

    const balance = await getBalance(user_id, tx);
    if (balance < price) {
      throw ApiError.unprocessable("Insufficient coin balance", {
        balance,
        required: price,
        missing: price - balance,
      });
    }

    const purchase = await tx.chapterPurchase.create({
      data: { user_id, chapter_id, price_coins: price, fee_coins: fee },
      select: { purchase_id: true, price_coins: true, created_at: true },
    });

    const balance_after = balance - price;
    await tx.walletTransaction.create({
      data: {
        user_id,
        type: "chapter_purchase",
        amount: price,
        balance_after,
        reference_id: purchase.purchase_id,
        created_at: ledgerTimestamp(),
      },
    });

    if (net > 0) {
      const authorBalance = await getBalance(author_id, tx);
      await tx.walletTransaction.create({
        data: {
          user_id: author_id,
          type: "chapter_sale",
          amount: net,
          balance_after: authorBalance + net,
          reference_id: purchase.purchase_id,
          created_at: ledgerTimestamp(),
        },
      });
    }

    // คืนเนื้อหาไปด้วยเลย ให้หน้าอ่านแสดงตอนที่เพิ่งปลดล็อกได้ทันทีโดยไม่ต้องโหลดหน้าใหม่
    return { ...purchase, chapter_id, balance_after, already_owned: false, content: chapter.content };
  }, WALLET_TX_OPTIONS);
}

/** เพิ่มภายหลัง (หน้า My Library / "อ่านต่อ") — จำตอนล่าสุดที่เปิดอ่าน (ตอนที่เปิดล่าสุด ไม่ใช่ตอนที่ไกลสุด
 *  ให้ "อ่านต่อ" พากลับไปจุดที่ผู้ใช้อยู่จริง แม้ย้อนกลับไปอ่านตอนก่อนหน้า) และถ้านิยายอยู่ในชั้น "อ่านต่อไป"
 *  (up_next) ให้ขยับเป็น "กำลังอ่าน" ให้เอง — ไม่แตะ completed ที่ผู้ใช้ตั้งไว้เอง
 *  fire-and-forget จาก getChapterById: การบันทึกพลาดต้องไม่ทำให้หน้าอ่านพัง */
async function recordReadingProgress(user_id: string, novel_id: string, chapter_id: string, chapter_number: number) {
  const now = new Date();
  await prisma.$transaction([
    prisma.readingProgress.upsert({
      where: { user_id_novel_id: { user_id, novel_id } },
      create: { user_id, novel_id, last_chapter_id: chapter_id, last_chapter_number: chapter_number, last_read_at: now },
      update: { last_chapter_id: chapter_id, last_chapter_number: chapter_number, last_read_at: now },
    }),
    prisma.userLibrary.updateMany({
      where: { user_id, novel_id, status: "up_next" },
      data: { status: "reading" },
    }),
  ]);
  // gap 2.2 — READ edge เกิดตั้งแต่อ่าน ไม่ต้องรอรีวิว (Neo4j ล่มต้องไม่กระทบหน้าอ่าน)
  syncReadEdge(user_id, novel_id, null, { last_chapter_number: chapter_number, last_read_at: now }).catch((err) =>
    console.error("Neo4j syncReadEdge failed:", err)
  );
}

interface UpdateChapterInput {
  title?: string;
  content?: string;
  status?: ChapterStatus;
  scheduled_publish_at?: Date;
  price_coins?: number;
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
      ...(input.price_coins !== undefined ? { price_coins: input.price_coins } : {}),
      ...(willPublishNow ? { published_at: new Date() } : {}),
      // เคลียร์เวลาตั้งเผยแพร่เดิมทิ้งถ้าเปลี่ยนสถานะไปเป็นอย่างอื่นที่ไม่ใช่ scheduled อีกต่อไป
      scheduled_publish_at: willSchedule ? input.scheduled_publish_at : input.status !== undefined ? null : undefined,
      updated_at: new Date(),
    },
    select: {
      chapter_id: true,
      chapter_number: true,
      title: true,
      content: true,
      status: true,
      word_count: true,
      published_at: true,
      scheduled_publish_at: true,
      price_coins: true,
      updated_at: true,
    },
  });

  if (willPublishNow) {
    await notifyLibraryOfNewChapter(chapter.novel_id, chapter.novel.author_id, updated);
  }

  return updated;
}

/** ย้ายลงถังขยะ (soft delete, 30 วัน) — ไม่ใช่ hard delete */
export async function deleteChapter(chapter_id: string, user_id: string) {
  const chapter = await getChapterWithNovel(chapter_id);
  if (chapter.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const { novel: _novel, ...row } = chapter;

  const trash = await prisma.$transaction(async (tx) => {
    // เพิ่มภายหลัง (ตอนติดเหรียญ) — การซื้อของผู้อ่านถูก cascade ลบไปกับแถวตอน เก็บไว้ใน snapshot
    // เพื่อกู้คืนพร้อมตอน (ผู้อ่านที่จ่ายแล้วไม่ต้องจ่ายซ้ำ) — ดู trash-bin.service.ts restore
    const purchases = await tx.chapterPurchase.findMany({
      where: { chapter_id },
      select: { purchase_id: true, user_id: true, price_coins: true, fee_coins: true, created_at: true },
    });
    const created = await moveToTrash(tx, {
      novel_id: chapter.novel_id,
      content_type: "chapter",
      content_ref_id: chapter.chapter_id,
      content_snapshot: { ...row, purchases },
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
  title?: string,
  base_updated_at?: Date
) {
  const chapter = await getChapterWithNovel(chapter_id);
  if (chapter.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  // gap 2.5 — กันเขียนทับข้ามแท็บ/อุปกรณ์: client ส่ง updated_at ที่ตัวเองเห็นล่าสุดมา ถ้าตอนนี้ถูกบันทึก
  // จากที่อื่นหลังจากนั้น (อีกแท็บ, กู้คืนเวอร์ชัน) ตอบ 409 ให้ผู้ใช้เลือกเองแทนการทับเงียบ ๆ
  if (base_updated_at && chapter.updated_at && chapter.updated_at.getTime() > base_updated_at.getTime()) {
    throw new ApiError(409, "ตอนนี้ถูกแก้ไขจากที่อื่นหลังจากที่คุณเปิดไว้", {
      code: "EDIT_CONFLICT",
      server_updated_at: chapter.updated_at,
    });
  }

  // เลข version ถัดไปต้องอ่านแล้วค่อย insert — autosave 2 ครั้งพร้อมกันของตอนเดียว (แท็บ 2 แท็บ, keepalive ตอนปิดแท็บ
  // ชนกับรอบ 30 วิ) เดิมได้เลขซ้ำแล้วชน unique (chapter_id, version_number) ตอบ 409 ทำให้งานรอบนั้นหาย (พบจาก k6 load test)
  // ล็อกแถวของตอนนั้นไว้ตลอด transaction ให้ autosave ของตอนเดียวกันต่อคิวกัน (ตอนอื่นไม่โดนล็อก)
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM chapters WHERE chapter_id = ${chapter_id}::uuid FOR UPDATE`;
    const latest = await tx.chapterVersion.findFirst({
      where: { chapter_id },
      orderBy: { version_number: "desc" },
      select: { version_number: true },
    });
    const version = await tx.chapterVersion.create({
      data: {
        chapter_id,
        content_snapshot,
        version_number: (latest?.version_number ?? 0) + 1,
        edited_by: user_id,
        is_autosave: true,
      },
      select: { version_id: true, version_number: true, is_autosave: true, created_at: true },
    });
    const updated = await tx.chapter.update({
      where: { chapter_id },
      data: {
        content: content_snapshot,
        word_count: computeWordCount(content_snapshot),
        ...(title !== undefined ? { title } : {}),
        updated_at: new Date(),
      },
      select: { updated_at: true },
    });
    return { ...version, chapter_updated_at: updated.updated_at };
  });
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
  sticker_id: string | null;
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
    select: commentRowSelect,
  });

  return { comments: buildCommentTree(rows) };
}

const commentRowSelect = {
  comment_id: true,
  chapter_id: true,
  parent_comment_id: true,
  content: true,
  sticker_id: true,
  sentiment_label: true,
  created_at: true,
  user: { select: { user_id: true, username: true, avatar_url: true } },
} satisfies Prisma.CommentSelect;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentRowSelect }>;

/** ประกอบ flat rows (เรียงตามเวลาแล้ว) เป็นต้นไม้ replies ตาม parent_comment_id */
function buildCommentTree(rows: CommentRow[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  for (const row of rows) {
    nodes.set(row.comment_id, {
      comment_id: row.comment_id,
      user: row.user,
      content: row.content,
      sticker_id: row.sticker_id,
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
  return roots;
}

/** เพิ่มภายหลัง (perf) — GET /novels/:novel_id/comments (Public, gated ด้วย visibility ของนิยายเหมือน
 *  listChapterComments) คอมเมนต์ของทุกตอนที่เผยแพร่แล้วในครั้งเดียว
 *
 *  เดิมหน้านิยายยิง GET /chapters/:id/comments ทีละตอน (N+1 ผ่าน HTTP — นิยาย 40 ตอน = 40 request
 *  x 2 query ต่อ request, หน้าช้า ~580 ms บน production build) ตอนนี้ใช้ 1 query เช็คสิทธิ์ + 2 query
 *  คู่ขนาน ไม่ว่าจะมีกี่ตอน */
export async function listNovelComments(novel_id: string, requester_id?: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true, visibility: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  assertNovelVisible(novel, requester_id);

  const [chapters, rows] = await Promise.all([
    prisma.chapter.findMany({
      where: { novel_id, status: "published" },
      orderBy: { chapter_number: "asc" },
      select: { chapter_id: true, chapter_number: true, title: true },
    }),
    prisma.comment.findMany({
      where: { chapter: { novel_id, status: "published" } },
      orderBy: { created_at: "asc" },
      select: commentRowSelect,
    }),
  ]);

  const rowsByChapter = new Map<string, CommentRow[]>();
  for (const row of rows) {
    const list = rowsByChapter.get(row.chapter_id);
    if (list) list.push(row);
    else rowsByChapter.set(row.chapter_id, [row]);
  }

  return {
    chapters: chapters.map((c) => ({ ...c, comments: buildCommentTree(rowsByChapter.get(c.chapter_id) ?? []) })),
  };
}

interface CreateCommentInput {
  content: string;
  sticker_id?: string;
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
      sticker_id: input.sticker_id,
      parent_comment_id: input.parent_comment_id,
    },
    select: { comment_id: true, content: true, sticker_id: true, sentiment_label: true, created_at: true },
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
