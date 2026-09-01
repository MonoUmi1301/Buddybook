import { prisma } from "@/lib/prisma";
import { moveToTrash } from "@/lib/trash";
import { ApiError } from "@/utils/ApiError";

async function assertNovelOwner(novel_id: string, user_id: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
}

interface CreateLocationInput {
  name: string;
  description?: string;
  map_icon_url?: string;
  category?: string;
  pos_x?: number;
  pos_y?: number;
}

/** Reference implementation — POST /novels/:novel_id/locations */
export async function createLocation(novel_id: string, user_id: string, input: CreateLocationInput) {
  await assertNovelOwner(novel_id, user_id);

  const location = await prisma.location.create({
    data: {
      novel_id,
      name: input.name,
      description: input.description,
      map_icon_url: input.map_icon_url,
      category: input.category,
      pos_x: input.pos_x ?? null,
      pos_y: input.pos_y ?? null,
    },
    select: { location_id: true, name: true, map_icon_url: true, category: true, pos_x: true, pos_y: true },
  });

  return location;
}

async function getOwnedLocation(location_id: string, user_id: string) {
  const location = await prisma.location.findUnique({
    where: { location_id },
    include: { novel: { select: { author_id: true } } },
  });
  if (!location) throw ApiError.notFound("Location not found");
  if (location.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
  return location;
}

interface UpdateLocationInput {
  name?: string;
  description?: string;
  map_icon_url?: string;
  category?: string;
  pos_x?: number;
  pos_y?: number;
  scale?: number;
  rotation?: number;
  flip_x?: boolean;
  z_index?: number;
  linked_chapter_id?: string | null;
}

export async function updateLocation(location_id: string, user_id: string, input: UpdateLocationInput) {
  const owned = await getOwnedLocation(location_id, user_id);

  // เพิ่มภายหลัง (audit fix) — หมุดผูกฐานข้อมูล (lore link) ต้องผูกกับตอนของนิยายเรื่องเดียวกัน
  // เท่านั้น กันเผลอผูกข้ามนิยาย (เช่น พิมพ์ chapter_id ของนิยายเรื่องอื่นมาตรง ๆ)
  if (input.linked_chapter_id) {
    const chapter = await prisma.chapter.findUnique({
      where: { chapter_id: input.linked_chapter_id },
      select: { novel_id: true },
    });
    if (!chapter || chapter.novel_id !== owned.novel_id) {
      throw ApiError.unprocessable("Linked chapter must belong to the same novel");
    }
  }

  const updated = await prisma.location.update({
    where: { location_id },
    data: input,
    select: {
      location_id: true,
      name: true,
      description: true,
      map_icon_url: true,
      category: true,
      pos_x: true,
      pos_y: true,
      scale: true,
      rotation: true,
      flip_x: true,
      z_index: true,
      linked_chapter_id: true,
    },
  });

  return updated;
}

export async function deleteLocation(location_id: string, user_id: string) {
  const location = await getOwnedLocation(location_id, user_id);
  const { novel: _novel, ...snapshot } = location;

  const trash = await prisma.$transaction(async (tx) => {
    const created = await moveToTrash(tx, {
      novel_id: location.novel_id,
      content_type: "location",
      content_ref_id: location.location_id,
      content_snapshot: snapshot,
      deleted_by: user_id,
    });
    await tx.locationEdge.deleteMany({
      where: { OR: [{ source_location_id: location_id }, { target_location_id: location_id }] },
    });
    await tx.location.delete({ where: { location_id } });
    return created;
  });

  return trash;
}

interface CreateLocationEdgeInput {
  source_location_id: string;
  target_location_id: string;
}

/** เพิ่มภายหลัง (audit fix) — เส้นทาง/ถนนเชื่อมสถานที่ พอร์ตมาจาก buddybook_demo/tool_map
 *  Reference implementation — POST /novels/:novel_id/location-edges */
export async function createLocationEdge(novel_id: string, user_id: string, input: CreateLocationEdgeInput) {
  if (input.source_location_id === input.target_location_id) {
    throw ApiError.unprocessable("A location cannot be linked to itself");
  }
  await assertNovelOwner(novel_id, user_id);

  const edge = await prisma.locationEdge.create({
    data: { novel_id, ...input },
    select: { edge_id: true, source_location_id: true, target_location_id: true },
  });

  return edge;
}

export async function deleteLocationEdge(edge_id: string, user_id: string) {
  const edge = await prisma.locationEdge.findUnique({
    where: { edge_id },
    include: { novel: { select: { author_id: true } } },
  });
  if (!edge) throw ApiError.notFound("Location edge not found");
  if (edge.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const { novel: _novel, ...snapshot } = edge;

  const trash = await prisma.$transaction(async (tx) => {
    const created = await moveToTrash(tx, {
      novel_id: edge.novel_id,
      content_type: "location_edge",
      content_ref_id: edge.edge_id,
      content_snapshot: snapshot,
      deleted_by: user_id,
    });
    await tx.locationEdge.delete({ where: { edge_id } });
    return created;
  });

  return trash;
}
