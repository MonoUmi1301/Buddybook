import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { syncNovelTags, syncReadEdge } from "@/lib/graphSync";
import { assertNovelVisible } from "@/lib/novelVisibility";
import { isViewerAgeVerified } from "@/lib/contentRating";
import type { ContentRating, LegalStatus, NovelFormat, NovelStatus, TagCategory, Visibility } from "@prisma/client";

interface SearchNovelsInput {
  q?: string;
  /** field เลือกว่า q ไปจับคู่กับอะไร — ตรงกับ 5 แท็บใน SearchFilterTabs.tsx ฝั่งหน้าเว็บ
   *  ("ทั้งหมด" ค้นทุก field พร้อมกันด้วย OR) default "all" ถ้าไม่ส่งมา */
  field?: "all" | "title" | "author" | "synopsis" | "tag";
  /** เพิ่มภายหลัง (Phase M) — แทนที่ tag_id เดี่ยวเดิม รองรับเลือกหลายแท็กพร้อมกันแบบ AO3
   *  (ต้องมีครบทุกแท็กที่เลือก ไม่ใช่แค่แท็กใดแท็กหนึ่ง — ดู AND clause ด้านล่าง) */
  tag_ids?: number[];
  /** เพิ่มภายหลัง (Phase M) — ค้นชื่อนักเขียนแยกอิสระจาก q/field แบบ AO3 (ช่องนักเขียน vs ช่องแท็ก
   *  คนละช่องกัน ใช้ร่วมกับเงื่อนไขอื่นได้พร้อมกันเสมอ ไม่ใช่ "โหมด" ที่ต้องสลับแบบ field=author เดิม) */
  author?: string;
  status?: NovelStatus;
  legal_status?: "original" | "fan-fiction" | "translation";
  /** sort=views ใช้กับ section "ติดท็อป" ของหน้าแรก, default "newest" ใช้กับ "ใหม่มาแรง"/ค้นหาทั่วไป */
  sort?: "newest" | "views";
  page: number;
  pageSize: number;
  /** mine=true — ส่วนขยายนอก API_Endpoints.md เดิม: ให้เจ้าของเห็นนิยายของตัวเองทุกสถานะ
   *  (search ปกติ hardcode visibility=published ซึ่งซ่อน draft/private ของเจ้าของเองด้วย —
   *  จำเป็นสำหรับหน้า Writer Dashboard ที่ต้องเห็นผลงานตัวเองครบ ไม่ใช่แค่ที่เผยแพร่แล้ว) */
  mine?: boolean;
  requester_id?: string;
}

async function buildContentRatingGate(scopedToOwn: boolean, requester_id?: string) {
  // เจ้าของดูผลงานตัวเองในหน้า Dashboard ได้ครบทุก rating เสมอ ไม่ต้องเช็ค age_verified
  if (scopedToOwn) return {};
  const verified = await isViewerAgeVerified(requester_id);
  return verified ? {} : { content_rating: { not: "mature" as ContentRating } };
}

function buildTextSearchClause(q: string, field: SearchNovelsInput["field"]) {
  const contains = { contains: q, mode: "insensitive" as const };
  switch (field) {
    case "title":
      return { title: contains };
    case "author":
      return { author: { username: contains } };
    case "synopsis":
      return { synopsis: contains };
    case "tag":
      return { novel_tags: { some: { tag: { name: contains } } } };
    default:
      return {
        OR: [
          { title: contains },
          { synopsis: contains },
          { author: { username: contains } },
          { novel_tags: { some: { tag: { name: contains } } } },
        ],
      };
  }
}

/** Reference implementation — GET /novels/search */
export async function searchNovels({
  q,
  field,
  tag_ids,
  author,
  status,
  legal_status,
  sort,
  page,
  pageSize,
  mine,
  requester_id,
}: SearchNovelsInput) {
  const scopedToOwn = Boolean(mine && requester_id);
  const ratingGate = await buildContentRatingGate(scopedToOwn, requester_id);

  const where = {
    ...(scopedToOwn ? { author_id: requester_id } : { visibility: "published" as Visibility }),
    ...(status ? { status } : {}),
    ...(legal_status ? { legal_status: LEGAL_STATUS_MAP[legal_status] } : {}),
    ...(q ? buildTextSearchClause(q, field) : {}),
    // ต้องมีครบทุกแท็กที่เลือก (AND) ไม่ใช่แค่แท็กใดแท็กหนึ่ง (OR) — ตรงกับพฤติกรรม multi-tag
    // filter แบบ AO3 ที่ผู้ใช้ระบุไว้ (เลือก "ชายรักชาย" + "แฟนตาซี" ต้องเจอเฉพาะเรื่องที่มีทั้งคู่)
    // แต่ละแท็กที่เลือกอาจอยู่ใน novel_tags (แท็กทั่วไป/ความสัมพันธ์/fandom) หรือเป็น
    // primary_tag_id/secondary_tag_id ก็ได้ (หมวดหมู่หลัก/รองไม่ได้ถูกเขียนซ้ำลง novel_tags)
    // ถ้าเช็คแค่ novel_tags เฉย ๆ นิยายที่ตั้งหมวดหมู่หลักไว้แต่ไม่ได้ติดแท็กซ้ำจะหลุดจากผลค้นหา
    ...(tag_ids?.length
      ? {
          AND: tag_ids.map((tag_id) => ({
            OR: [{ novel_tags: { some: { tag_id } } }, { primary_tag_id: tag_id }, { secondary_tag_id: tag_id }],
          })),
        }
      : {}),
    ...(author ? { author: { username: { contains: author, mode: "insensitive" as const } } } : {}),
    ...ratingGate,
  };

  const [novels, total] = await Promise.all([
    prisma.novel.findMany({
      where,
      select: {
        novel_id: true,
        title: true,
        cover_image_url: true,
        status: true,
        visibility: true,
        view_count: true,
        format: true,
        content_rating: true,
        author: { select: { user_id: true, username: true, pen_name: true } },
      },
      orderBy: sort === "views" ? { view_count: "desc" } : { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.novel.count({ where }),
  ]);

  // ไม่มี field คะแนนเฉลี่ยสำเร็จรูปบน Novel — คำนวณจาก Review.rating เอาเอง ต้อง groupBy แยก
  // เพราะ Prisma ยังไม่รองรับ aggregate ในตัว findMany relation โดยตรง
  const ratings = novels.length
    ? await prisma.review.groupBy({
        by: ["novel_id"],
        where: { novel_id: { in: novels.map((n) => n.novel_id) }, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      })
    : [];
  const ratingByNovel = new Map(ratings.map((r) => [r.novel_id, r]));

  const likes = novels.length
    ? await prisma.novelLike.groupBy({
        by: ["novel_id"],
        where: { novel_id: { in: novels.map((n) => n.novel_id) } },
        _count: { novel_id: true },
      })
    : [];
  const likeCountByNovel = new Map(likes.map((l) => [l.novel_id, l._count.novel_id]));

  // view_count เป็น BigInt ใน Postgres — res.json() (JSON.stringify) serialize BigInt ตรง ๆ ไม่ได้
  return {
    novels: novels.map((n) => {
      const r = ratingByNovel.get(n.novel_id);
      return {
        ...n,
        view_count: Number(n.view_count),
        rating: r?._avg.rating ?? 0,
        review_count: r?._count.rating ?? 0,
        like_count: likeCountByNovel.get(n.novel_id) ?? 0,
      };
    }),
    total,
    page,
  };
}

interface CreateNovelInput {
  title: string;
  synopsis?: string;
  cover_image_url?: string;
  legal_status: "original" | "fan-fiction" | "translation";
  tag_ids: number[];
  // เพิ่มภายหลัง (Phase B, wizard สร้างนิยาย 2 ขั้นตอน)
  format?: NovelFormat;
  is_translated?: boolean;
  content_rating?: ContentRating;
  allow_donations?: boolean;
  allow_screenshots?: boolean;
  allow_comments?: boolean;
  hide_like_count?: boolean;
  primary_tag_id?: number;
  secondary_tag_id?: number;
  // เพิ่มภายหลัง (Phase H) — แท็กที่ผู้ใช้พิมพ์เอง ไม่ได้เลือกจากลิสต์ที่มีอยู่
  tag_names?: string[];
  // เพิ่มภายหลัง (Phase M) — แท็กความสัมพันธ์/คู่ และแท็ก fandom แยกกลุ่มจากแท็กทั่วไป
  pairing_tag_ids?: number[];
  pairing_tag_names?: string[];
  fandom_tag_ids?: number[];
  fandom_tag_names?: string[];
}

const LEGAL_STATUS_MAP: Record<CreateNovelInput["legal_status"], LegalStatus> = {
  original: "original",
  "fan-fiction": "fan_fiction",
  translation: "translation",
};

/** เพิ่มภายหลัง (Phase H, ขยายรับ category ใน Phase M) — รองรับแท็กที่ผู้ใช้พิมพ์เองแบบ ReadAWrite
 *  แทนที่จะเลือกจากลิสต์คงที่ของ admin เท่านั้น หา tag ที่ชื่อตรงกัน (case-insensitive) ก่อน ถ้าไม่มี
 *  ค่อยสร้างใหม่ — category เริ่มต้นเป็น null (แท็กทั่วไป) แต่กล่องพิมพ์เฉพาะทาง (ความสัมพันธ์/fandom)
 *  ส่ง category มาให้ตรงกลุ่ม เพื่อให้แท็กที่พิมพ์ใหม่ยังถูกจัดกลุ่มถูกต้อง ไม่ปนกับแท็กทั่วไป */
async function resolveTagNames(names: string[], category: TagCategory | null = null): Promise<number[]> {
  const resolved: number[] = [];
  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;
    const existing = await prisma.tag.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (existing) {
      resolved.push(existing.tag_id);
      continue;
    }
    try {
      const created = await prisma.tag.create({ data: { name, category } });
      resolved.push(created.tag_id);
    } catch (err) {
      // แข่งกันสร้างชื่อเดียวกันพร้อมกัน (unique constraint) — หาใหม่แทนที่จะ throw ทิ้งทั้ง request
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const retried = await prisma.tag.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
        if (retried) resolved.push(retried.tag_id);
      } else {
        throw err;
      }
    }
  }
  return resolved;
}

/** เพิ่มภายหลัง (Phase L/M) — ตรวจ server-side ว่าหมวดหมู่รองที่เลือกเป็นลูกของหมวดหมู่หลักจริง
 *  (ไม่เชื่อ frontend cascading select อย่างเดียว — ป้องกันคนยิง API ตรง ๆ ข้าม UI) */
async function assertValidCategoryHierarchy(primary_tag_id?: number | null, secondary_tag_id?: number | null) {
  if (!secondary_tag_id) return;
  const secondary = await prisma.tag.findUnique({ where: { tag_id: secondary_tag_id }, select: { parent_tag_id: true } });
  if (!secondary || secondary.parent_tag_id !== (primary_tag_id ?? null)) {
    throw ApiError.unprocessable("หมวดหมู่รองต้องเป็นหมวดหมู่ย่อยของหมวดหมู่หลักที่เลือกไว้");
  }
}

/** Reference implementation — POST /novels */
export async function createNovel(author_id: string, input: CreateNovelInput) {
  await assertValidCategoryHierarchy(input.primary_tag_id, input.secondary_tag_id);

  const [generalNewIds, pairingNewIds, fandomNewIds] = await Promise.all([
    input.tag_names?.length ? resolveTagNames(input.tag_names) : Promise.resolve([]),
    input.pairing_tag_names?.length ? resolveTagNames(input.pairing_tag_names, "pairing") : Promise.resolve([]),
    input.fandom_tag_names?.length ? resolveTagNames(input.fandom_tag_names, "fandom") : Promise.resolve([]),
  ]);
  const allTagIds = Array.from(
    new Set([
      ...input.tag_ids,
      ...generalNewIds,
      ...(input.pairing_tag_ids ?? []),
      ...pairingNewIds,
      ...(input.fandom_tag_ids ?? []),
      ...fandomNewIds,
    ])
  );

  const novel = await prisma.novel.create({
    data: {
      author_id,
      title: input.title,
      synopsis: input.synopsis,
      cover_image_url: input.cover_image_url,
      legal_status: LEGAL_STATUS_MAP[input.legal_status],
      // audit fix — เดิมพึ่ง default ของ schema.prisma (visibility @default(published)) ทำให้นิยาย
      // ทุกเรื่องเผยแพร่สู่สาธารณะทันทีตั้งแต่กด "สร้างนิยาย" โดยที่ผู้เขียนยังไม่ได้ยืนยันว่าพร้อม
      // เปิดให้อ่านจริง — เปลี่ยนเป็นเริ่มที่ private เสมอ แล้วให้เลือกจริงที่หน้า choose (หลังสร้างเสร็จ)
      visibility: "private",
      format: input.format,
      is_translated: input.is_translated,
      content_rating: input.content_rating,
      allow_donations: input.allow_donations,
      allow_screenshots: input.allow_screenshots,
      allow_comments: input.allow_comments,
      hide_like_count: input.hide_like_count,
      primary_tag_id: input.primary_tag_id,
      secondary_tag_id: input.secondary_tag_id,
      novel_tags: allTagIds.length ? { create: allTagIds.map((tag_id) => ({ tag_id })) } : undefined,
    },
    select: { novel_id: true, title: true, status: true, created_at: true },
  });

  if (allTagIds.length) {
    prisma.tag
      .findMany({ where: { tag_id: { in: allTagIds } }, select: { name: true } })
      .then((tags) => syncNovelTags(novel.novel_id, novel.title, tags.map((t) => t.name)))
      .catch((err) => console.error("Neo4j syncNovelTags failed:", err));
  }

  return novel;
}

interface UpdateNovelInput {
  title?: string;
  synopsis?: string;
  cover_image_url?: string;
  status?: NovelStatus;
  visibility?: Visibility;
  tag_ids?: number[];
  format?: NovelFormat;
  is_translated?: boolean;
  content_rating?: ContentRating;
  allow_donations?: boolean;
  allow_screenshots?: boolean;
  allow_comments?: boolean;
  hide_like_count?: boolean;
  primary_tag_id?: number | null;
  secondary_tag_id?: number | null;
  // เพิ่มภายหลัง (Phase H) — แท็กที่ผู้ใช้พิมพ์เอง ไม่ได้เลือกจากลิสต์ที่มีอยู่
  tag_names?: string[];
  // เพิ่มภายหลัง (Phase M) — แท็กความสัมพันธ์/คู่ และแท็ก fandom แยกกลุ่มจากแท็กทั่วไป
  pairing_tag_ids?: number[];
  pairing_tag_names?: string[];
  fandom_tag_ids?: number[];
  fandom_tag_names?: string[];
}

/** Reference implementation — PATCH /novels/:novel_id (เจ้าของเท่านั้นที่แก้ได้) */
export async function updateNovel(novel_id: string, user_id: string, input: UpdateNovelInput) {
  const existing = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!existing) throw ApiError.notFound("Novel not found");
  if (existing.author_id !== user_id) throw ApiError.forbidden("Forbidden");
  await assertValidCategoryHierarchy(input.primary_tag_id, input.secondary_tag_id);

  const { tag_ids, tag_names, pairing_tag_ids, pairing_tag_names, fandom_tag_ids, fandom_tag_names, ...rest } = input;
  // แตะแท็กกลุ่มไหนกลุ่มหนึ่ง = ถือว่าส่ง "ชุดแท็กที่ต้องการทั้งหมด" มาแทนที่ทั้งก้อน (novel_tags เป็น
  // ตารางเดียวแบนไม่แยกกลุ่มจริง — EditNovelForm ส่งครบทุกกลุ่มทุกครั้งที่บันทึกอยู่แล้ว)
  const touchingTags =
    tag_ids !== undefined ||
    tag_names !== undefined ||
    pairing_tag_ids !== undefined ||
    pairing_tag_names !== undefined ||
    fandom_tag_ids !== undefined ||
    fandom_tag_names !== undefined;

  let allTagIds: number[] | undefined;
  if (touchingTags) {
    const [generalNewIds, pairingNewIds, fandomNewIds] = await Promise.all([
      tag_names?.length ? resolveTagNames(tag_names) : Promise.resolve([]),
      pairing_tag_names?.length ? resolveTagNames(pairing_tag_names, "pairing") : Promise.resolve([]),
      fandom_tag_names?.length ? resolveTagNames(fandom_tag_names, "fandom") : Promise.resolve([]),
    ]);
    allTagIds = Array.from(
      new Set([
        ...(tag_ids ?? []),
        ...generalNewIds,
        ...(pairing_tag_ids ?? []),
        ...pairingNewIds,
        ...(fandom_tag_ids ?? []),
        ...fandomNewIds,
      ])
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (allTagIds !== undefined) {
      await tx.novelTag.deleteMany({ where: { novel_id } });
      if (allTagIds.length) {
        await tx.novelTag.createMany({ data: allTagIds.map((tag_id) => ({ novel_id, tag_id })) });
      }
    }
    return tx.novel.update({
      where: { novel_id },
      data: { ...rest, updated_at: new Date() },
      select: {
        novel_id: true,
        title: true,
        synopsis: true,
        cover_image_url: true,
        status: true,
        visibility: true,
        format: true,
        is_translated: true,
        content_rating: true,
        allow_donations: true,
        allow_screenshots: true,
        allow_comments: true,
        hide_like_count: true,
        primary_tag_id: true,
        secondary_tag_id: true,
        updated_at: true,
      },
    });
  });

  if (allTagIds === undefined) return updated;

  // แยกดึงชื่อจริงของแท็กหลัง resolve tag_names เสร็จ (รวมแท็กใหม่ที่เพิ่งสร้าง) ทั้ง sync เข้า
  // Neo4j และคืนกลับไปให้ frontend ใช้แทนการเดา/คำนวณเอง (สำคัญเพราะแท็กใหม่ยังไม่มี tag_id ฝั่ง client)
  const resolvedTags = await prisma.tag.findMany({
    where: { tag_id: { in: allTagIds } },
    select: { tag_id: true, name: true, category: true },
  });

  syncNovelTags(novel_id, updated.title, resolvedTags.map((t) => t.name)).catch((err) =>
    console.error("Neo4j syncNovelTags failed:", err)
  );

  return { ...updated, tags: resolvedTags };
}

/** Reference implementation — GET /novels/:novel_id/world-building
 *  แปลง character_nodes/character_edges/locations/timeline_events เป็นรูปที่ @xyflow/react
 *  ใช้ตรง ๆ ได้เลย (Node/Edge shape) ตามที่ระบุใน BuddyBook_Data_Dictionary_and_Schema.md
 *  (node_id=React Flow node.id, position_x/y=node.position ฯลฯ) */
export async function getWorldBuilding(novel_id: string, user_id: string) {
  const novel = await prisma.novel.findUnique({
    where: { novel_id },
    select: { author_id: true, plot_notes: true, theme_notes: true, map_drawings: true },
  });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const [characterNodes, characterEdges, locations, locationEdges, timelineEvents] = await Promise.all([
    prisma.characterNode.findMany({ where: { novel_id } }),
    prisma.characterEdge.findMany({ where: { novel_id } }),
    prisma.location.findMany({ where: { novel_id }, orderBy: { created_at: "asc" } }),
    prisma.locationEdge.findMany({ where: { novel_id } }),
    prisma.timelineEvent.findMany({ where: { novel_id }, orderBy: { event_order: "asc" } }),
  ]);

  return {
    // เพิ่มภายหลัง (audit fix) — เดิม pre-shape เป็น react-flow Node ตรง ๆ ที่นี่ (position เป็น
    // number เสมอ) ตอนนี้ position_x/y เป็น nullable แล้ว (null = ยังไม่ถูกวางบนแคนวาส) ส่งเป็น
    // raw field แทน ให้ frontend เป็นคนตัดสินใจว่าจะสร้าง react-flow Node (วางแล้ว) หรือใส่ใน
    // แถบ "รอวาง" (ยังไม่วาง) เอง
    characters: characterNodes.map((n) => ({
      node_id: n.node_id,
      name: n.character_name,
      avatar_url: n.avatar_url ?? undefined,
      description: n.description ?? undefined,
      character_role: n.character_role ?? undefined,
      position_x: n.position_x,
      position_y: n.position_y,
      style: n.node_style ?? undefined,
    })),
    edges: characterEdges.map((e) => ({
      id: e.edge_id,
      source: e.source_node_id,
      target: e.target_node_id,
      label: e.edge_label ?? undefined,
      type: e.edge_type,
      style: e.edge_style ?? undefined,
      data: { relationship_type: e.relationship_type ?? undefined, description: e.description ?? undefined },
    })),
    locations: locations.map((l) => ({
      location_id: l.location_id,
      name: l.name,
      description: l.description,
      map_icon_url: l.map_icon_url,
      category: l.category,
      pos_x: l.pos_x,
      pos_y: l.pos_y,
      scale: l.scale,
      rotation: l.rotation,
      flip_x: l.flip_x,
      z_index: l.z_index,
      linked_chapter_id: l.linked_chapter_id,
    })),
    location_edges: locationEdges.map((e) => ({
      id: e.edge_id,
      source: e.source_location_id,
      target: e.target_location_id,
    })),
    timeline_events: timelineEvents.map((t) => ({
      event_id: t.event_id,
      title: t.title,
      description: t.description,
      event_order: t.event_order,
      event_date_in_story: t.event_date_in_story,
      event_time: t.event_time,
      thread: t.thread,
      color: t.color,
      intensity: t.intensity,
    })),
    plot_notes: novel.plot_notes ?? {},
    theme_notes: novel.theme_notes ?? {},
    map_drawings: novel.map_drawings ?? [],
  };
}

/** เพิ่มภายหลัง (audit fix) — บันทึกจริงสำหรับแท็บ Plot ของเครื่องมือ world-building
 *  (แทนที่ UI mock เดิมที่ปุ่ม "บันทึก" ไม่เคยยิง API) เก็บทั้งก้อนทับของเดิมเสมอ (ไม่ merge)
 *  เพราะ frontend ส่งค่าปัจจุบันของทุกช่องมาให้ครบทุกครั้งอยู่แล้ว */
export async function updatePlotNotes(novel_id: string, user_id: string, notes: Record<string, string | undefined>) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const updated = await prisma.novel.update({
    where: { novel_id },
    data: { plot_notes: notes },
    select: { plot_notes: true },
  });
  return { plot_notes: updated.plot_notes };
}

/** คู่กับ updatePlotNotes — สำหรับแท็บ Theme */
export async function updateThemeNotes(novel_id: string, user_id: string, notes: Record<string, string | undefined>) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const updated = await prisma.novel.update({
    where: { novel_id },
    data: { theme_notes: notes },
    select: { theme_notes: true },
  });
  return { theme_notes: updated.theme_notes };
}

/** เพิ่มภายหลัง (audit fix) — บันทึกเส้นอิสระที่วาดด้วยมือบนแผนที่ (แท็บ Base) ทับก้อนเดิมเสมอ
 *  (ไม่ merge) เพราะ frontend ส่ง array ของเส้นทั้งหมดมาให้ครบทุกครั้งอยู่แล้วเหมือน plot/theme notes */
export async function updateMapDrawings(novel_id: string, user_id: string, drawings: unknown[]) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const updated = await prisma.novel.update({
    where: { novel_id },
    data: { map_drawings: drawings as Prisma.InputJsonValue },
    select: { map_drawings: true },
  });
  return { map_drawings: updated.map_drawings };
}

const MAX_MAP_VERSIONS = 20;

async function assertNovelOwner(novel_id: string, user_id: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
}

/** เพิ่มภายหลัง (audit fix) — ประวัติเวอร์ชันแผนที่: snapshot สถานที่/ถนน/เส้นวาดปัจจุบันทั้งก้อน
 *  ผู้ใช้กดบันทึกเองเป็นจุด ๆ (ไม่ auto-snapshot ทุกการกระทำย่อย กันประวัติล้นจากการลากปรับตำแหน่ง
 *  เล็ก ๆ น้อย ๆ) เก็บไว้ล่าสุด 20 เวอร์ชันต่อนิยาย เก่ากว่านั้นลบทิ้งอัตโนมัติ */
export async function createMapVersion(novel_id: string, user_id: string) {
  await assertNovelOwner(novel_id, user_id);

  const [locations, locationEdges, novel] = await Promise.all([
    prisma.location.findMany({ where: { novel_id } }),
    prisma.locationEdge.findMany({ where: { novel_id } }),
    prisma.novel.findUnique({ where: { novel_id }, select: { map_drawings: true } }),
  ]);

  const snapshot = {
    locations,
    location_edges: locationEdges,
    map_drawings: novel?.map_drawings ?? [],
  };

  const created = await prisma.mapVersion.create({
    data: { novel_id, snapshot: snapshot as unknown as Prisma.InputJsonValue },
    select: { version_id: true, created_at: true },
  });

  const stale = await prisma.mapVersion.findMany({
    where: { novel_id },
    orderBy: { created_at: "desc" },
    skip: MAX_MAP_VERSIONS,
    select: { version_id: true },
  });
  if (stale.length > 0) {
    await prisma.mapVersion.deleteMany({ where: { version_id: { in: stale.map((s) => s.version_id) } } });
  }

  return created;
}

export async function listMapVersions(novel_id: string, user_id: string) {
  await assertNovelOwner(novel_id, user_id);

  const versions = await prisma.mapVersion.findMany({
    where: { novel_id },
    orderBy: { created_at: "desc" },
    select: { version_id: true, created_at: true },
  });
  return { versions };
}

interface MapVersionSnapshot {
  locations: Array<Record<string, unknown> & { location_id: string }>;
  location_edges: Array<Record<string, unknown> & { edge_id: string }>;
  map_drawings: unknown;
}

/** กู้คืนแผนที่จาก version ที่เลือก — ลบสถานที่/ถนนปัจจุบันทั้งหมดแล้วสร้างใหม่จาก snapshot โดยใช้
 *  location_id/edge_id เดิม (คง reference ของถนนที่ชี้ไปยังสถานที่ให้ถูกต้องหลังกู้คืน) */
export async function restoreMapVersion(version_id: string, user_id: string) {
  const version = await prisma.mapVersion.findUnique({
    where: { version_id },
    include: { novel: { select: { novel_id: true, author_id: true } } },
  });
  if (!version) throw ApiError.notFound("Map version not found");
  if (version.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const snapshot = version.snapshot as unknown as MapVersionSnapshot;
  const novel_id = version.novel.novel_id;

  await prisma.$transaction(async (tx) => {
    await tx.locationEdge.deleteMany({ where: { novel_id } });
    await tx.location.deleteMany({ where: { novel_id } });

    for (const loc of snapshot.locations) {
      const { novel: _novel, linked_chapter: _lc, edges_as_source: _es, edges_as_target: _et, ...data } = loc as Record<string, unknown>;
      await tx.location.create({ data: data as Prisma.LocationCreateManyInput });
    }
    for (const edge of snapshot.location_edges) {
      const { novel: _novel, source_location: _sl, target_location: _tl, ...data } = edge as Record<string, unknown>;
      await tx.locationEdge.create({ data: data as Prisma.LocationEdgeCreateManyInput });
    }
    await tx.novel.update({ where: { novel_id }, data: { map_drawings: snapshot.map_drawings as Prisma.InputJsonValue } });
  });

  return { restored: true };
}

/** Reference implementation — GET /novels/:novel_id/reviews (Public, gated by novel visibility) */
export async function listNovelReviews(novel_id: string, viewer_id?: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { visibility: true, author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  assertNovelVisible(novel, viewer_id);

  const reviews = await prisma.review.findMany({
    where: { novel_id },
    orderBy: { created_at: "desc" },
    include: { user: { select: { user_id: true, username: true, avatar_url: true } } },
  });

  return {
    // audit fix — รีวิวที่เลือกไม่ระบุตัวตน (is_anonymous) ต้องไม่ส่ง username/avatar จริงออกไปให้
    // คนอื่นเห็นเลย ยกเว้นเจ้าของรีวิวเองที่ดูรีวิวของตัวเอง (viewer_id ตรงกับ user_id) ยังเห็น
    // ข้อมูลจริงของตัวเองได้ตามปกติ — คง user_id ไว้เสมอเพราะ FE ใช้เทียบว่าเป็นรีวิวของ viewer เอง
    reviews: reviews.map((r) => ({
      review_id: r.review_id,
      user:
        r.is_anonymous && r.user.user_id !== viewer_id
          ? { user_id: r.user.user_id, username: null, avatar_url: null }
          : r.user,
      is_anonymous: r.is_anonymous,
      rating: r.rating,
      comment_text: r.comment_text,
      sentiment_label: r.sentiment_label,
      created_at: r.created_at,
    })),
  };
}

interface CreateReviewInput {
  rating: number;
  comment_text?: string;
  is_anonymous?: boolean;
}

/** Reference implementation — POST /novels/:novel_id/reviews
 *  sentiment_label เป็น null เสมอตอน insert — Python NLP Worker จะ UPDATE กลับมาแบบ async ทีหลัง */
export async function createReview(novel_id: string, user_id: string, input: CreateReviewInput) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { novel_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");

  try {
    const review = await prisma.review.create({
      data: {
        novel_id,
        user_id,
        rating: input.rating,
        comment_text: input.comment_text,
        is_anonymous: input.is_anonymous ?? false,
      },
      select: { review_id: true, rating: true, sentiment_label: true, is_anonymous: true, created_at: true },
    });

    // สร้าง READ edge ทันที (sentiment_score เป็น null ก่อน — Phase NLP Worker จะเรียก
    // syncReadEdge ซ้ำพร้อมคะแนนจริงหลังวิเคราะห์เสร็จ อัปเดต edge เดิมแทนที่จะสร้างใหม่)
    syncReadEdge(user_id, novel_id, null).catch((err) => console.error("Neo4j syncReadEdge failed:", err));

    return review;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("You have already reviewed this novel");
    }
    throw err;
  }
}

/** Reference implementation — GET /novels/:novel_id/donations (Public, gated by novel visibility —
 *  ส่วนขยายนอก API_Endpoints.md เดิม — จำเป็นเพื่อแสดง "ผู้สนับสนุนสูงสุด" หลังมี POST /donations จริงแล้ว) */
export async function listNovelDonors(novel_id: string, viewer_id?: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { visibility: true, author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  assertNovelVisible(novel, viewer_id);

  const grouped = await prisma.donation.groupBy({
    by: ["from_user_id"],
    where: { novel_id },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  });

  const users = await prisma.user.findMany({
    where: { user_id: { in: grouped.map((g) => g.from_user_id) } },
    select: { user_id: true, username: true, avatar_url: true },
  });
  const userMap = new Map(users.map((u) => [u.user_id, u]));

  return {
    donors: grouped
      .map((g) => ({
        user: userMap.get(g.from_user_id),
        total_coins: g._sum.amount?.toNumber() ?? 0,
      }))
      .filter((d) => d.user),
  };
}

/** Reference implementation — DELETE /novels/:novel_id
 *  ลบถาวรจริง (ไม่ใช่ trash bin — TrashContentType ไม่มีค่า "novel" ตาม data dictionary
 *  การลบนิยายทั้งเรื่องเป็น hard delete พร้อม cascade ลบ chapters/world-building ที่ผูกอยู่ทั้งหมด) */
export async function deleteNovel(novel_id: string, user_id: string) {
  const existing = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!existing) throw ApiError.notFound("Novel not found");
  if (existing.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  await prisma.novel.delete({ where: { novel_id } });
}

/** Reference implementation — GET /novels/:novel_id/print-preview (เจ้าของเท่านั้น ตาม
 *  API_Endpoints.md ส่วนที่ 3 Writer Workspace) — คืนทุกตอนเรียงตามลำดับพร้อมเนื้อหาเต็ม
 *  ไม่กรอง status เพราะเจ้าของต้องพรีวิวตอน draft ที่ยังไม่เผยแพร่ได้ด้วย */
export async function getPrintPreview(novel_id: string, user_id: string) {
  const novel = await prisma.novel.findUnique({
    where: { novel_id },
    select: { novel_id: true, title: true, synopsis: true, author_id: true, author: { select: { username: true, pen_name: true } } },
  });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");

  const chapters = await prisma.chapter.findMany({
    where: { novel_id },
    orderBy: { chapter_number: "asc" },
    select: { chapter_number: true, title: true, content: true },
  });

  return {
    novel: { novel_id: novel.novel_id, title: novel.title, synopsis: novel.synopsis, author: novel.author },
    chapters,
  };
}

/** Reference implementation — GET /novels/:novel_id */
export async function getNovelById(novel_id: string, viewer_id?: string) {
  const novel = await prisma.novel.findUnique({
    where: { novel_id },
    select: {
      novel_id: true,
      title: true,
      synopsis: true,
      cover_image_url: true,
      status: true,
      legal_status: true,
      visibility: true,
      view_count: true,
      created_at: true,
      format: true,
      is_translated: true,
      content_rating: true,
      allow_donations: true,
      allow_screenshots: true,
      allow_comments: true,
      hide_like_count: true,
      primary_tag: { select: { tag_id: true, name: true } },
      secondary_tag: { select: { tag_id: true, name: true } },
      author: { select: { user_id: true, username: true, pen_name: true, avatar_url: true } },
      novel_tags: { select: { tag: { select: { tag_id: true, name: true, category: true } } } },
      // เฉพาะ field ที่ปลอดภัยให้สาธารณะเห็น (ไม่ใช่ทั้ง world-building canvas ซึ่งเป็นเครื่องมือ
      // ของเจ้าของนิยายเท่านั้น ดู GET /novels/:id/world-building ที่ requireAuth+เช็คความเป็นเจ้าของ) —
      // ใช้แสดงการ์ด "แนะนำตัวละคร" ในหน้ารายละเอียดนิยายสาธารณะแทนของ mock เดิม
      character_nodes: {
        select: { node_id: true, character_name: true, avatar_url: true, character_role: true },
        orderBy: { created_at: "asc" },
        take: 8,
      },
      _count: { select: { novel_likes: true } },
    },
  });

  if (!novel) throw ApiError.notFound("Novel not found");

  const isOwner = assertNovelVisible({ visibility: novel.visibility, author_id: novel.author.user_id }, viewer_id);
  if (novel.content_rating === "mature" && !isOwner && !(await isViewerAgeVerified(viewer_id))) {
    throw ApiError.forbidden("ต้องยืนยันอายุ 18 ปีขึ้นไปก่อนถึงจะดูนิยายเรื่องนี้ได้", {
      code: "AGE_VERIFICATION_REQUIRED",
    });
  }

  const is_liked = viewer_id
    ? Boolean(await prisma.novelLike.findUnique({ where: { user_id_novel_id: { user_id: viewer_id, novel_id } } }))
    : false;

  const { novel_tags, view_count, _count, ...rest } = novel;
  return {
    ...rest,
    view_count: Number(view_count),
    tags: novel_tags.map((nt) => nt.tag),
    like_count: _count.novel_likes,
    is_liked,
  };
}

/** Reference implementation — POST /novels/:novel_id/like (เพิ่มภายหลัง audit pass หลัง Phase 9 —
 *  ดู schema.prisma NovelLike สำหรับที่มา) idempotent ด้วย unique constraint เหมือน addToLibrary */
export async function likeNovel(novel_id: string, user_id: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { novel_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");

  try {
    await prisma.novelLike.create({ data: { user_id, novel_id } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    // อยู่แล้ว — ทำเป็นสำเร็จเงียบ ๆ (idempotent) แทนการ throw conflict เพราะปุ่มถูกใจกดซ้ำได้ปกติ
  }

  const like_count = await prisma.novelLike.count({ where: { novel_id } });
  return { liked: true, like_count };
}

export async function unlikeNovel(novel_id: string, user_id: string) {
  await prisma.novelLike.deleteMany({ where: { novel_id, user_id } });
  const like_count = await prisma.novelLike.count({ where: { novel_id } });
  return { liked: false, like_count };
}
