import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { libraryNovelSelect, toLibraryNovel } from "@/modules/library/library.service";

export const COLLECTION_TINTS = ["purple", "coral", "blue", "orange", "mint", "pink"] as const;
export type CollectionTint = (typeof COLLECTION_TINTS)[number];

async function getOwnedCollection(collection_id: string, user_id: string) {
  const collection = await prisma.collection.findUnique({ where: { collection_id } });
  // ของคนอื่นตอบ 404 เหมือนไม่มีอยู่ — ไม่บอกว่ามี collection_id นี้จริงในระบบ
  if (!collection || collection.user_id !== user_id) throw ApiError.notFound("Collection not found");
  return collection;
}

/** GET /collections — ชั้นย่อยทั้งหมดของผู้ใช้พร้อมนิยายในชั้น (เรียงตาม position) */
export async function listCollections(user_id: string) {
  const collections = await prisma.collection.findMany({
    where: { user_id },
    orderBy: [{ position: "asc" }, { created_at: "asc" }],
    include: {
      items: {
        orderBy: [{ position: "asc" }, { added_at: "asc" }],
        include: { novel: { select: libraryNovelSelect } },
      },
    },
  });

  return {
    collections: collections.map(({ items, ...c }) => ({
      ...c,
      novels: items.map((i) => toLibraryNovel(i.novel)),
    })),
  };
}

/** เปลี่ยนภายหลัง (เลิกใช้อีโมจิ) — ไอคอนชั้นเป็นชุดคงที่ หน้าเว็บวาดด้วยไอคอนของเว็บเอง
 *  (ดู apps/web/src/lib/collectionIcons.ts ต้องมี key ตรงกัน) */
export const COLLECTION_ICONS = [
  "books",
  "heart",
  "star",
  "moon",
  "sun",
  "coffee",
  "waves",
  "leaf",
  "flame",
  "ghost",
  "swords",
  "sparkles",
  "feather",
  "music",
] as const;
export type CollectionIcon = (typeof COLLECTION_ICONS)[number];

export async function createCollection(user_id: string, input: { name: string; icon?: CollectionIcon | null; tint?: CollectionTint }) {
  const last = await prisma.collection.findFirst({ where: { user_id }, orderBy: { position: "desc" }, select: { position: true } });
  return prisma.collection.create({
    data: { user_id, name: input.name, icon: input.icon ?? null, tint: input.tint ?? "purple", position: (last?.position ?? -1) + 1 },
  });
}

export async function updateCollection(
  collection_id: string,
  user_id: string,
  input: { name?: string; icon?: CollectionIcon | null; tint?: CollectionTint; position?: number }
) {
  await getOwnedCollection(collection_id, user_id);
  return prisma.collection.update({ where: { collection_id }, data: input });
}

export async function deleteCollection(collection_id: string, user_id: string) {
  await getOwnedCollection(collection_id, user_id);
  // ลบแค่ชั้นย่อย นิยายยังอยู่ในชั้นหนังสือหลัก (items cascade ตาม FK)
  await prisma.collection.delete({ where: { collection_id } });
}

/** POST /collections/:id/items — ใส่นิยายลงชั้นย่อย ถ้ายังไม่อยู่ในชั้นหนังสือหลักจะเพิ่มให้ด้วย
 *  (collection เป็นชั้นย่อยของชั้นหนังสือ — ไม่ควรมีนิยายในชั้นย่อยที่ไม่อยู่ในชั้นหลัก) */
export async function addItem(collection_id: string, user_id: string, novel_id: string) {
  await getOwnedCollection(collection_id, user_id);
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { novel_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");

  const last = await prisma.collectionItem.findFirst({
    where: { collection_id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.$transaction([
    prisma.userLibrary.upsert({
      where: { user_id_novel_id: { user_id, novel_id } },
      create: { user_id, novel_id },
      update: {},
    }),
    prisma.collectionItem.upsert({
      where: { collection_id_novel_id: { collection_id, novel_id } },
      create: { collection_id, novel_id, position: (last?.position ?? -1) + 1 },
      update: {},
    }),
  ]);
  return { collection_id, novel_id };
}

export async function removeItem(collection_id: string, user_id: string, novel_id: string) {
  await getOwnedCollection(collection_id, user_id);
  await prisma.collectionItem.deleteMany({ where: { collection_id, novel_id } });
}
