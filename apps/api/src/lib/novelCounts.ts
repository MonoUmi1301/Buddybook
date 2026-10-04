import { prisma } from "@/lib/prisma";

/**
 * นับจำนวนต่อนิยายเฉพาะชุด novel_id ที่ส่งมา (เช่น การ์ดนิยายในหน้าเดียว) คืน Map novel_id → จำนวน
 *
 * ใช้แทน `_count: { select: { chapters: ... } }` ใน findMany ที่ดึงหลายเรื่อง: Prisma แปลง relation count
 * เป็น LEFT JOIN (SELECT novel_id, COUNT(*) ... GROUP BY novel_id) ที่ Postgres ต้องนับ "ทุกแถวทั้งตาราง"
 * ก่อนค่อยกรองเหลือไม่กี่เรื่องที่แสดง — ช้าขึ้นตามขนาดทั้งเว็บ ไม่ใช่ตามจำนวนการ์ด (ค้นหา 8 เรื่องต้อง
 * สแกนตอนทั้งหมดทุกครั้ง) ส่วน groupBy ด้วย novel_id IN (...) ใช้ index แตะเฉพาะแถวของเรื่องที่แสดง
 * (ค้นหาเรื่องเดียวด้วย primary key ไม่มีปัญหานี้ ใช้ _count ต่อได้)
 */
type CountRow = { novel_id: string; _count: { _all: number } };
const toMap = (rows: CountRow[]) => new Map(rows.map((r) => [r.novel_id, r._count._all]));

export async function countChaptersByNovel(novel_ids: string[], opts: { publishedOnly: boolean }) {
  if (novel_ids.length === 0) return new Map<string, number>();
  const rows = await prisma.chapter.groupBy({
    by: ["novel_id"],
    where: { novel_id: { in: novel_ids }, ...(opts.publishedOnly ? { status: "published" as const } : {}) },
    _count: { _all: true },
  });
  return toMap(rows);
}

export async function countLikesByNovel(novel_ids: string[]) {
  if (novel_ids.length === 0) return new Map<string, number>();
  const rows = await prisma.novelLike.groupBy({ by: ["novel_id"], where: { novel_id: { in: novel_ids } }, _count: { _all: true } });
  return toMap(rows);
}

/** ผู้อ่าน = จำนวนคนที่มี reading_progress ของเรื่องนั้น (ใช้ index reading_progress(novel_id)) */
export async function countReadersByNovel(novel_ids: string[]) {
  if (novel_ids.length === 0) return new Map<string, number>();
  const rows = await prisma.readingProgress.groupBy({
    by: ["novel_id"],
    where: { novel_id: { in: novel_ids } },
    _count: { _all: true },
  });
  return toMap(rows);
}

export async function countReviewsByNovel(novel_ids: string[]) {
  if (novel_ids.length === 0) return new Map<string, number>();
  const rows = await prisma.review.groupBy({ by: ["novel_id"], where: { novel_id: { in: novel_ids } }, _count: { _all: true } });
  return toMap(rows);
}
