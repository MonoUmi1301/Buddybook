import { prisma } from "@/lib/prisma";
import { moveToTrash } from "@/lib/trash";
import { ApiError } from "@/utils/ApiError";
import type { CharacterRole } from "@prisma/client";

async function assertNovelOwner(novel_id: string, user_id: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
}

interface CreateCharacterInput {
  character_name: string;
  avatar_url?: string;
  description?: string;
  character_role?: CharacterRole;
  // เพิ่มภายหลัง (audit fix) — optional แล้ว: ไม่ส่งมา = ยังไม่วางบนแคนวาส (อยู่ในแถบ "รอวาง")
  position_x?: number;
  position_y?: number;
}

/** Reference implementation — POST /novels/:novel_id/characters */
export async function createCharacterNode(novel_id: string, user_id: string, input: CreateCharacterInput) {
  await assertNovelOwner(novel_id, user_id);

  const node = await prisma.characterNode.create({
    data: {
      novel_id,
      character_name: input.character_name,
      avatar_url: input.avatar_url,
      description: input.description,
      character_role: input.character_role,
      position_x: input.position_x ?? null,
      position_y: input.position_y ?? null,
    },
    select: { node_id: true, character_name: true, avatar_url: true, position_x: true, position_y: true },
  });

  return node;
}

async function getOwnedNode(node_id: string, user_id: string) {
  const node = await prisma.characterNode.findUnique({
    where: { node_id },
    include: { novel: { select: { author_id: true } } },
  });
  if (!node) throw ApiError.notFound("Character not found");
  if (node.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
  return node;
}

interface UpdateCharacterInput {
  character_name?: string;
  avatar_url?: string;
  description?: string;
  character_role?: CharacterRole;
  position_x?: number;
  position_y?: number;
}

export async function updateCharacterNode(node_id: string, user_id: string, input: UpdateCharacterInput) {
  await getOwnedNode(node_id, user_id);

  const updated = await prisma.characterNode.update({
    where: { node_id },
    data: { ...input, updated_at: new Date() },
    select: {
      node_id: true,
      character_name: true,
      avatar_url: true,
      description: true,
      character_role: true,
      position_x: true,
      position_y: true,
    },
  });

  return updated;
}

/** ย้ายลงถังขยะ (soft delete) — ลบ edges ที่ต่อกับ node นี้ไปด้วย เพื่อไม่ให้ trash_bin
 *  มี edge ค้างที่ชี้ไปยัง node ที่ไม่มีอยู่แล้ว (FK เป็น Cascade อยู่แล้วแต่ทำ explicit
 *  ให้แน่ใจว่า edge ทั้งสองฝั่งถูกจัดการก่อน node หาย) */
export async function deleteCharacterNode(node_id: string, user_id: string) {
  const node = await getOwnedNode(node_id, user_id);
  const { novel: _novel, ...snapshot } = node;

  const trash = await prisma.$transaction(async (tx) => {
    const created = await moveToTrash(tx, {
      novel_id: node.novel_id,
      content_type: "character_node",
      content_ref_id: node.node_id,
      content_snapshot: snapshot,
      deleted_by: user_id,
    });
    await tx.characterEdge.deleteMany({
      where: { OR: [{ source_node_id: node_id }, { target_node_id: node_id }] },
    });
    await tx.characterNode.delete({ where: { node_id } });
    return created;
  });

  return trash;
}

interface CreateEdgeInput {
  source_node_id: string;
  target_node_id: string;
  relationship_type?: string;
  edge_label?: string;
  description?: string;
  edge_type?: string;
}

/** Reference implementation — POST /novels/:novel_id/character-edges
 *  self-loop เช็คไว้ทั้งที่ controller (novels.controller.ts, เส้นทางจริงที่ frontend ใช้) และที่นี่
 *  (audit fix — ชั้นป้องกันสำรอง เผื่อมี caller อื่นเรียก service ตรงในอนาคตโดยข้าม controller เดิม) */
export async function createCharacterEdge(novel_id: string, user_id: string, input: CreateEdgeInput) {
  if (input.source_node_id === input.target_node_id) {
    throw ApiError.unprocessable("A character cannot be linked to itself");
  }

  await assertNovelOwner(novel_id, user_id);

  const edge = await prisma.characterEdge.create({
    data: { novel_id, ...input },
    select: { edge_id: true, source_node_id: true, target_node_id: true },
  });

  return edge;
}

async function getOwnedEdge(edge_id: string, user_id: string) {
  const edge = await prisma.characterEdge.findUnique({
    where: { edge_id },
    include: { novel: { select: { author_id: true } } },
  });
  if (!edge) throw ApiError.notFound("Character edge not found");
  if (edge.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
  return edge;
}

interface UpdateEdgeInput {
  relationship_type?: string;
  edge_label?: string;
  description?: string;
  edge_type?: string;
}

export async function updateCharacterEdge(edge_id: string, user_id: string, input: UpdateEdgeInput) {
  await getOwnedEdge(edge_id, user_id);

  const updated = await prisma.characterEdge.update({
    where: { edge_id },
    data: input,
    select: { edge_id: true, relationship_type: true, edge_label: true, description: true, edge_type: true },
  });

  return updated;
}

export async function deleteCharacterEdge(edge_id: string, user_id: string) {
  const edge = await getOwnedEdge(edge_id, user_id);
  const { novel: _novel, ...snapshot } = edge;

  const trash = await prisma.$transaction(async (tx) => {
    const created = await moveToTrash(tx, {
      novel_id: edge.novel_id,
      content_type: "character_edge",
      content_ref_id: edge.edge_id,
      content_snapshot: snapshot,
      deleted_by: user_id,
    });
    await tx.characterEdge.delete({ where: { edge_id } });
    return created;
  });

  return trash;
}
