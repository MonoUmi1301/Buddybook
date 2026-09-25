import { Prisma, type LibraryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";

/** ข้อมูลนิยายที่หน้า My Library / "อ่านต่อ" ใช้ — ใช้ร่วมกันทั้ง library และ collections */
export const libraryNovelSelect = {
  novel_id: true,
  title: true,
  cover_image_url: true,
  status: true,
  view_count: true,
  author: { select: { user_id: true, username: true, pen_name: true } },
  _count: { select: { chapters: { where: { status: "published" as const } } } },
} satisfies Prisma.NovelSelect;

type LibraryNovelRow = Prisma.NovelGetPayload<{ select: typeof libraryNovelSelect }>;

export function toLibraryNovel({ _count, view_count, ...novel }: LibraryNovelRow) {
  return { ...novel, view_count: Number(view_count), chapter_count: _count.chapters };
}

type ProgressRow = { last_chapter_id: string | null; last_chapter_number: number; last_read_at: Date };

function toProgress(p: ProgressRow | undefined | null) {
  return p ? { last_chapter_id: p.last_chapter_id, last_chapter_number: p.last_chapter_number, last_read_at: p.last_read_at } : null;
}

/** Reference implementation — GET /library (?status=reading|up_next|completed)
 *  เพิ่มภายหลัง (หน้า My Library) — แนบ status, ความคืบหน้าการอ่าน และ collection ที่นิยายอยู่
 *  รูปร่าง response เดิม (library_id/novel/added_at) ยังอยู่ครบ — หน้ารายละเอียดนิยายยังใช้อยู่ */
export async function listLibrary(user_id: string, status?: LibraryStatus) {
  const items = await prisma.userLibrary.findMany({
    where: { user_id, ...(status ? { status } : {}) },
    orderBy: { added_at: "desc" },
    include: { novel: { select: libraryNovelSelect } },
  });

  const novelIds = items.map((i) => i.novel_id);
  const [progress, collectionItems, counts] = await Promise.all([
    prisma.readingProgress.findMany({ where: { user_id, novel_id: { in: novelIds } } }),
    prisma.collectionItem.findMany({
      where: { novel_id: { in: novelIds }, collection: { user_id } },
      select: { novel_id: true, collection_id: true },
    }),
    // นับทุกสถานะเสมอ (ไม่ขึ้นกับ ?status) — ให้ปุ่มกรองโชว์ตัวเลขครบแม้กำลังกรองอยู่
    prisma.userLibrary.groupBy({ by: ["status"], where: { user_id }, _count: { _all: true } }),
  ]);
  const progressByNovel = new Map(progress.map((p) => [p.novel_id, p]));
  const collectionsByNovel = new Map<string, string[]>();
  for (const ci of collectionItems) {
    collectionsByNovel.set(ci.novel_id, [...(collectionsByNovel.get(ci.novel_id) ?? []), ci.collection_id]);
  }

  const statusCounts = { reading: 0, up_next: 0, completed: 0 };
  for (const c of counts) statusCounts[c.status] = c._count._all;

  return {
    library: items.map((item) => ({
      library_id: item.library_id,
      novel: toLibraryNovel(item.novel),
      added_at: item.added_at,
      status: item.status,
      progress: toProgress(progressByNovel.get(item.novel_id)),
      collection_ids: collectionsByNovel.get(item.novel_id) ?? [],
    })),
    counts: { all: statusCounts.reading + statusCounts.up_next + statusCounts.completed, ...statusCounts },
  };
}

/** Reference implementation — POST /library */
export async function addToLibrary(user_id: string, novel_id: string, status?: LibraryStatus) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { novel_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");

  // ถ้าเคยเปิดอ่านมาก่อนแล้ว ให้เข้าชั้นเป็น "กำลังอ่าน" เลย ไม่ใช่ "อ่านต่อไป"
  const hasProgress = status
    ? false
    : Boolean(await prisma.readingProgress.findUnique({ where: { user_id_novel_id: { user_id, novel_id } } }));

  try {
    const entry = await prisma.userLibrary.create({
      data: { user_id, novel_id, status: status ?? (hasProgress ? "reading" : "up_next") },
      select: { library_id: true, novel_id: true, added_at: true, status: true },
    });
    return entry;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("Novel already in library");
    }
    throw err;
  }
}

/** เพิ่มภายหลัง (หน้า My Library) — PATCH /library/:novel_id { status } */
export async function updateLibraryStatus(user_id: string, novel_id: string, status: LibraryStatus) {
  const result = await prisma.userLibrary.updateMany({ where: { user_id, novel_id }, data: { status } });
  if (result.count === 0) throw ApiError.notFound("Novel not in library");
  return { novel_id, status };
}

export async function removeFromLibrary(user_id: string, novel_id: string) {
  // เอาออกจากชั้น = เอาออกจากทุก collection ของผู้ใช้ด้วย (collection เป็นชั้นย่อยของชั้นหนังสือ)
  await prisma.$transaction([
    prisma.collectionItem.deleteMany({ where: { novel_id, collection: { user_id } } }),
    prisma.userLibrary.deleteMany({ where: { user_id, novel_id } }),
  ]);
}

/** เพิ่มภายหลัง — GET /library/continue-reading?limit= — ประวัติการอ่านล่าสุด (หน้าแรก "อ่านต่อ" และ
 *  หน้า My Library "กำลังอ่าน") รวมเรื่องที่ไม่ได้เพิ่มเข้าชั้นด้วย ตัดเรื่องที่ถูกซ่อน/ยังไม่เผยแพร่ออก
 *  และตัดเรื่องที่ผู้ใช้ตั้งเป็น "อ่านจบแล้ว" ในชั้นออก (ไม่ต้อง "อ่านต่อ" แล้ว) */
export async function listContinueReading(user_id: string, limit: number) {
  const rows = await prisma.readingProgress.findMany({
    where: {
      user_id,
      novel: { visibility: "published", NOT: { user_library: { some: { user_id, status: "completed" } } } },
    },
    orderBy: { last_read_at: "desc" },
    take: limit,
    include: { novel: { select: libraryNovelSelect } },
  });

  return {
    items: rows.map((r) => ({ novel: toLibraryNovel(r.novel), progress: toProgress(r)! })),
  };
}
