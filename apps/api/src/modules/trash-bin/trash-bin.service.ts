import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import type { ChapterStatus, CharacterRole, Prisma, TrashContentType } from "@prisma/client";

async function assertNovelOwner(novel_id: string, user_id: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
}

/** Reference implementation — GET /novels/:novel_id/trash-bin */
export async function listNovelTrash(novel_id: string, user_id: string) {
  await assertNovelOwner(novel_id, user_id);

  const items = await prisma.trashBin.findMany({
    where: { novel_id, restored_at: null },
    orderBy: { deleted_at: "desc" },
    select: {
      trash_id: true,
      content_type: true,
      content_snapshot: true,
      deleted_at: true,
      auto_delete_at: true,
    },
  });

  return { items };
}

async function getOwnedTrashItem(trash_id: string, user_id: string) {
  const item = await prisma.trashBin.findUnique({
    where: { trash_id },
    include: { novel: { select: { author_id: true } } },
  });
  if (!item) throw ApiError.notFound("Trash item not found");
  if (item.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
  return item;
}

type Snapshot = Record<string, unknown>;

/** สร้าง record ต้นทางกลับจาก content_snapshot ที่เก็บไว้ตอน soft-delete
 *  หมายเหตุ: chapter ที่ restore จะไม่มีประวัติ chapter_versions เก่ากลับมา (cascade หายไปตอน hard-delete
 *  ตัวแถวต้นฉบับ) — snapshot เก็บแค่เนื้อหาล่าสุด ณ วินาทีที่ลบ ซึ่งเพียงพอสำหรับ "กู้คืน" ตาม spec */
async function recreateFromSnapshot(
  tx: Prisma.TransactionClient,
  content_type: TrashContentType,
  snapshot: Snapshot
) {
  switch (content_type) {
    case "chapter": {
      const created = await tx.chapter.create({
        data: {
          chapter_id: snapshot.chapter_id as string,
          novel_id: snapshot.novel_id as string,
          chapter_number: snapshot.chapter_number as number,
          title: snapshot.title as string,
          content: (snapshot.content as string | null) ?? undefined,
          status: snapshot.status as ChapterStatus,
          word_count: snapshot.word_count as number,
          published_at: snapshot.published_at ? new Date(snapshot.published_at as string) : null,
          // audit fix — เดิมหลุด field นี้ตอน restore ทำให้ตอนที่ status="scheduled" ถูก trash ไปแล้ว
          // กู้คืนกลับมาจะเสียเวลาตั้งเผยแพร่เดิมทิ้ง (แม้ status จะกลับมาถูกต้อง)
          scheduled_publish_at: snapshot.scheduled_publish_at
            ? new Date(snapshot.scheduled_publish_at as string)
            : null,
          created_at: new Date(snapshot.created_at as string),
        },
        select: { chapter_id: true },
      });
      return created.chapter_id;
    }
    case "character_node": {
      const created = await tx.characterNode.create({
        data: {
          node_id: snapshot.node_id as string,
          novel_id: snapshot.novel_id as string,
          character_name: snapshot.character_name as string,
          avatar_url: (snapshot.avatar_url as string | null) ?? undefined,
          description: (snapshot.description as string | null) ?? undefined,
          character_role: (snapshot.character_role as CharacterRole | null) ?? undefined,
          node_type: snapshot.node_type as string,
          position_x: snapshot.position_x as number,
          position_y: snapshot.position_y as number,
          node_style: (snapshot.node_style as Prisma.InputJsonValue | null) ?? undefined,
          created_at: new Date(snapshot.created_at as string),
        },
        select: { node_id: true },
      });
      return created.node_id;
    }
    case "character_edge": {
      const created = await tx.characterEdge.create({
        data: {
          edge_id: snapshot.edge_id as string,
          novel_id: snapshot.novel_id as string,
          source_node_id: snapshot.source_node_id as string,
          target_node_id: snapshot.target_node_id as string,
          relationship_type: (snapshot.relationship_type as string | null) ?? undefined,
          edge_label: (snapshot.edge_label as string | null) ?? undefined,
          description: (snapshot.description as string | null) ?? undefined,
          edge_type: snapshot.edge_type as string,
          edge_style: (snapshot.edge_style as Prisma.InputJsonValue | null) ?? undefined,
          created_at: new Date(snapshot.created_at as string),
        },
        select: { edge_id: true },
      });
      return created.edge_id;
    }
    case "location": {
      const created = await tx.location.create({
        data: {
          location_id: snapshot.location_id as string,
          novel_id: snapshot.novel_id as string,
          name: snapshot.name as string,
          description: (snapshot.description as string | null) ?? undefined,
          map_icon_url: (snapshot.map_icon_url as string | null) ?? undefined,
          category: (snapshot.category as string | null) ?? undefined,
          pos_x: (snapshot.pos_x as number | null) ?? null,
          pos_y: (snapshot.pos_y as number | null) ?? null,
          created_at: new Date(snapshot.created_at as string),
        },
        select: { location_id: true },
      });
      return created.location_id;
    }
    case "location_edge": {
      const created = await tx.locationEdge.create({
        data: {
          edge_id: snapshot.edge_id as string,
          novel_id: snapshot.novel_id as string,
          source_location_id: snapshot.source_location_id as string,
          target_location_id: snapshot.target_location_id as string,
          created_at: new Date(snapshot.created_at as string),
        },
        select: { edge_id: true },
      });
      return created.edge_id;
    }
    case "timeline_event": {
      const created = await tx.timelineEvent.create({
        data: {
          event_id: snapshot.event_id as string,
          novel_id: snapshot.novel_id as string,
          title: snapshot.title as string,
          description: (snapshot.description as string | null) ?? undefined,
          event_order: snapshot.event_order as number,
          event_date_in_story: (snapshot.event_date_in_story as string | null) ?? undefined,
          event_time: (snapshot.event_time as string | null) ?? undefined,
          thread: (snapshot.thread as string | null) ?? undefined,
          color: (snapshot.color as string | null) ?? undefined,
          intensity: (snapshot.intensity as number | null) ?? undefined,
          created_at: new Date(snapshot.created_at as string),
        },
        select: { event_id: true },
      });
      return created.event_id;
    }
    default:
      throw ApiError.badRequest("Unknown trash content type");
  }
}

/** Reference implementation — POST /trash-bin/:trash_id/restore */
export async function restoreTrashItem(trash_id: string, user_id: string) {
  const item = await getOwnedTrashItem(trash_id, user_id);

  if (item.restored_at) throw ApiError.conflict("Item already restored");
  if (item.auto_delete_at <= new Date()) throw ApiError.gone("Item already purged");

  const restored_id = await prisma.$transaction(async (tx) => {
    const id = await recreateFromSnapshot(tx, item.content_type, item.content_snapshot as Snapshot);
    await tx.trashBin.update({ where: { trash_id }, data: { restored_at: new Date() } });
    return id;
  });

  return { content_type: item.content_type, restored_id, restored_at: new Date() };
}

/** Reference implementation — DELETE /trash-bin/:trash_id (ลบถาวรจริง) */
export async function deleteTrashItemPermanently(trash_id: string, user_id: string) {
  await getOwnedTrashItem(trash_id, user_id);
  await prisma.trashBin.delete({ where: { trash_id } });
}
