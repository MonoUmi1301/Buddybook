import type { Request, Response } from "express";
import { z } from "zod";
import * as novelsService from "@/modules/novels/novels.service";
import * as chaptersService from "@/modules/chapters/chapters.service";
import * as trashBinService from "@/modules/trash-bin/trash-bin.service";
import * as charactersService from "@/modules/characters/characters.service";
import * as locationsService from "@/modules/locations/locations.service";
import * as timelineService from "@/modules/timeline/timeline.service";
import { ApiError } from "@/utils/ApiError";

// เพิ่มภายหลัง (Phase M) — comma-joined string จาก query string เลี่ยงปัญหา array query-param
// parsing ของ Express/URLSearchParams ที่ต้องใช้ ?x=1&x=2
const idListParam = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0) : undefined));

const searchQuerySchema = z.object({
  q: z.string().optional(),
  field: z.enum(["all", "title", "author", "synopsis", "tag"]).optional(),
  // เพิ่มภายหลัง (Phase S, MASTER BRIEF) — แยกตาม category ชัดเจนแทน tag_ids รวมเดียวเดิม
  // (genre_ids/pairing_ids/fandom_ids/tag_ids) — ทั้งหมดยังคง AND กันด้วยกลไกเดียวกันใน searchNovels
  // เพราะ novel_tags ไม่ได้แยกตารางตาม category จริง แค่ frontend ส่งมาคนละ param ให้ UI ชัดเจนขึ้น
  genre_ids: idListParam,
  // เพิ่มภายหลัง (audit fix, search UX polish) — หมวดหมู่รอง (sub-genre) เลือกแยกจาก genre_ids
  // หลัก แต่ยังคง AND เข้ากลุ่มเดียวกันเหมือนกลุ่มอื่น ๆ ทั้งหมด (ดู allTagIds ด้านล่าง)
  sub_genre_ids: idListParam,
  pairing_ids: idListParam,
  fandom_ids: idListParam,
  tag_ids: idListParam,
  author: z.string().trim().max(100).optional(),
  status: z.enum(["ongoing", "completed", "hiatus"]).optional(),
  legal_status: z.enum(["original", "fan-fiction", "translation"]).optional(),
  // เพิ่มภายหลัง (Phase S) — alias ของ legal_status ตามชื่อ param ที่ผู้ใช้ระบุใน MASTER BRIEF
  workType: z.enum(["original", "fanfiction"]).optional(),
  sort: z.enum(["newest", "views"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  mine: z.coerce.boolean().optional(),
});

export async function search(req: Request, res: Response) {
  const {
    q,
    field,
    genre_ids,
    sub_genre_ids,
    pairing_ids,
    fandom_ids,
    tag_ids,
    author,
    status,
    legal_status,
    workType,
    sort,
    page,
    pageSize,
    mine,
  } = searchQuerySchema.parse(req.query);

  // workType ('original'|'fanfiction') คือ alias ของ legal_status ('original'|'fan-fiction') ตาม
  // MASTER BRIEF — ไม่เพิ่ม DB field ใหม่ซ้ำซ้อน ถ้าส่งมาทั้งคู่ legal_status (ชัดเจนกว่า) ชนะ
  const effectiveLegalStatus = legal_status ?? (workType === "fanfiction" ? "fan-fiction" : workType);

  const allTagIds = [
    ...(genre_ids ?? []),
    ...(sub_genre_ids ?? []),
    ...(pairing_ids ?? []),
    ...(fandom_ids ?? []),
    ...(tag_ids ?? []),
  ];

  const result = await novelsService.searchNovels({
    q,
    field,
    tag_ids: allTagIds.length ? allTagIds : undefined,
    author,
    status,
    legal_status: effectiveLegalStatus,
    sort,
    page,
    pageSize,
    mine,
    requester_id: req.user?.user_id,
  });
  res.status(200).json(result);
}

const novelIdParamSchema = z.object({ novel_id: z.string().uuid() });

export async function getById(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const novel = await novelsService.getNovelById(novel_id, req.user?.user_id);
  res.status(200).json(novel);
}

export async function like(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await novelsService.likeNovel(novel_id, req.user!.user_id);
  res.status(200).json(result);
}

export async function unlike(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await novelsService.unlikeNovel(novel_id, req.user!.user_id);
  res.status(200).json(result);
}

const createNovelBodySchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    synopsis: z.string().max(10000).optional(),
    cover_image_url: z.string().url().optional(),
    legal_status: z.enum(["original", "fan-fiction", "translation"]),
    tag_ids: z.array(z.number().int().positive()).default([]),
    // เพิ่มภายหลัง (Phase B, wizard สร้างนิยาย 2 ขั้นตอน)
    format: z.enum(["multi_chapter", "one_shot"]).optional(),
    is_translated: z.boolean().optional(),
    content_rating: z.enum(["all_ages", "teen", "mature"]).optional(),
    allow_donations: z.boolean().optional(),
    allow_screenshots: z.boolean().optional(),
    allow_comments: z.boolean().optional(),
    primary_tag_id: z.number().int().positive().optional(),
    secondary_tag_id: z.number().int().positive().optional(),
    // เพิ่มภายหลัง (Phase H) — แท็กที่ผู้ใช้พิมพ์เอง แทนที่จะเลือกจากลิสต์ที่ admin คุมอยู่เท่านั้น
    tag_names: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    // เพิ่มภายหลัง (Phase M) — แท็กความสัมพันธ์/คู่ และแท็ก fandom แยกกลุ่มจากแท็กทั่วไป
    pairing_tag_ids: z.array(z.number().int().positive()).max(5).optional(),
    pairing_tag_names: z.array(z.string().trim().min(1).max(30)).max(5).optional(),
    fandom_tag_ids: z.array(z.number().int().positive()).max(5).optional(),
    fandom_tag_names: z.array(z.string().trim().min(1).max(30)).max(5).optional(),
  })
  .refine((v) => !v.primary_tag_id || !v.secondary_tag_id || v.primary_tag_id !== v.secondary_tag_id, {
    message: "primary_tag_id and secondary_tag_id must differ",
    path: ["secondary_tag_id"],
  })
  .refine((v) => v.tag_ids.length + (v.tag_names?.length ?? 0) <= 10, {
    message: "A novel can have at most 10 tags total",
    path: ["tag_names"],
  })
  .refine((v) => (v.pairing_tag_ids?.length ?? 0) + (v.pairing_tag_names?.length ?? 0) <= 5, {
    message: "A novel can have at most 5 pairing tags",
    path: ["pairing_tag_names"],
  })
  .refine((v) => (v.fandom_tag_ids?.length ?? 0) + (v.fandom_tag_names?.length ?? 0) <= 5, {
    message: "A novel can have at most 5 fandom tags",
    path: ["fandom_tag_names"],
  });

export async function create(req: Request, res: Response) {
  const body = createNovelBodySchema.parse(req.body);
  const novel = await novelsService.createNovel(req.user!.user_id, body);
  res.status(201).json(novel);
}

const updateNovelBodySchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    synopsis: z.string().max(10000).optional(),
    cover_image_url: z.string().url().optional(),
    status: z.enum(["ongoing", "completed", "hiatus"]).optional(),
    visibility: z.enum(["published", "private", "pending_review"]).optional(),
    tag_ids: z.array(z.number().int().positive()).optional(),
    format: z.enum(["multi_chapter", "one_shot"]).optional(),
    is_translated: z.boolean().optional(),
    content_rating: z.enum(["all_ages", "teen", "mature"]).optional(),
    allow_donations: z.boolean().optional(),
    allow_screenshots: z.boolean().optional(),
    allow_comments: z.boolean().optional(),
    primary_tag_id: z.number().int().positive().nullable().optional(),
    secondary_tag_id: z.number().int().positive().nullable().optional(),
    // เพิ่มภายหลัง (Phase H) — แท็กที่ผู้ใช้พิมพ์เอง แทนที่จะเลือกจากลิสต์ที่ admin คุมอยู่เท่านั้น
    tag_names: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    // เพิ่มภายหลัง (Phase M) — แท็กความสัมพันธ์/คู่ และแท็ก fandom แยกกลุ่มจากแท็กทั่วไป
    pairing_tag_ids: z.array(z.number().int().positive()).max(5).optional(),
    pairing_tag_names: z.array(z.string().trim().min(1).max(30)).max(5).optional(),
    fandom_tag_ids: z.array(z.number().int().positive()).max(5).optional(),
    fandom_tag_names: z.array(z.string().trim().min(1).max(30)).max(5).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" })
  .refine((v) => !v.primary_tag_id || !v.secondary_tag_id || v.primary_tag_id !== v.secondary_tag_id, {
    message: "primary_tag_id and secondary_tag_id must differ",
    path: ["secondary_tag_id"],
  })
  .refine((v) => (v.tag_ids?.length ?? 0) + (v.tag_names?.length ?? 0) <= 10, {
    message: "A novel can have at most 10 tags total",
    path: ["tag_names"],
  })
  .refine((v) => (v.pairing_tag_ids?.length ?? 0) + (v.pairing_tag_names?.length ?? 0) <= 5, {
    message: "A novel can have at most 5 pairing tags",
    path: ["pairing_tag_names"],
  })
  .refine((v) => (v.fandom_tag_ids?.length ?? 0) + (v.fandom_tag_names?.length ?? 0) <= 5, {
    message: "A novel can have at most 5 fandom tags",
    path: ["fandom_tag_names"],
  });

export async function update(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = updateNovelBodySchema.parse(req.body);
  const novel = await novelsService.updateNovel(novel_id, req.user!.user_id, body);
  res.status(200).json(novel);
}

export async function remove(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  await novelsService.deleteNovel(novel_id, req.user!.user_id);
  res.status(204).send();
}

export async function printPreview(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await novelsService.getPrintPreview(novel_id, req.user!.user_id);
  res.status(200).json(result);
}

export async function listChapters(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await chaptersService.listNovelChapters(novel_id, req.user?.user_id);
  res.status(200).json(result);
}

const createChapterBodySchema = z
  .object({
    chapter_number: z.number().int().positive(),
    title: z.string().trim().min(1).max(255),
    content: z.string().optional(),
    status: z.enum(["draft", "published", "scheduled", "hidden"]),
    scheduled_publish_at: z.coerce.date().optional(),
  })
  .refine((v) => v.status !== "scheduled" || (v.scheduled_publish_at && v.scheduled_publish_at > new Date()), {
    message: "scheduled_publish_at is required and must be in the future when status is scheduled",
    path: ["scheduled_publish_at"],
  });

export async function createChapterForNovel(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createChapterBodySchema.parse(req.body);
  const chapter = await chaptersService.createChapter(novel_id, req.user!.user_id, body);
  res.status(201).json(chapter);
}

export async function listTrashBin(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await trashBinService.listNovelTrash(novel_id, req.user!.user_id);
  res.status(200).json(result);
}

export async function worldBuilding(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await novelsService.getWorldBuilding(novel_id, req.user!.user_id);
  res.status(200).json(result);
}

const plotNotesBodySchema = z.object({
  intro: z.string().max(5000).optional(),
  twist: z.string().max(5000).optional(),
  elements: z.string().max(5000).optional(),
  realization: z.string().max(5000).optional(),
  resolution: z.string().max(5000).optional(),
  ending: z.string().max(5000).optional(),
});

export async function updatePlotNotes(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = plotNotesBodySchema.parse(req.body);
  const result = await novelsService.updatePlotNotes(novel_id, req.user!.user_id, body);
  res.status(200).json(result);
}

const themeNotesBodySchema = z.object({
  mainTheme: z.string().max(5000).optional(),
  symbol: z.string().max(5000).optional(),
  message: z.string().max(5000).optional(),
});

export async function updateThemeNotes(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = themeNotesBodySchema.parse(req.body);
  const result = await novelsService.updateThemeNotes(novel_id, req.user!.user_id, body);
  res.status(200).json(result);
}

// เพิ่มภายหลัง (audit fix) — องค์ประกอบอิสระบนแผนที่ (แท็บ Base): เส้นวาดมือ ("line"), พื้นที่
// ระบายภูมิประเทศแบบปิดรูป ("fill"), และไอคอนปั๊มสิ่งกีดขวางแบบวางต่อเนื่อง ("stamp")
const mapPointSchema = z.object({ x: z.number(), y: z.number() });
const mapDrawingBodySchema = z.union([
  z.object({
    id: z.string().min(1).max(100),
    kind: z.literal("line").optional(),
    points: z.array(mapPointSchema).min(1).max(2000),
    width: z.number().min(1).max(20),
    color: z.string().trim().max(20).optional(),
  }),
  z.object({
    id: z.string().min(1).max(100),
    kind: z.literal("fill"),
    points: z.array(mapPointSchema).min(3).max(2000),
    color: z.string().trim().max(20),
  }),
  z.object({
    id: z.string().min(1).max(100),
    kind: z.literal("stamp"),
    icon: z.string().trim().max(30),
    x: z.number(),
    y: z.number(),
    rotation: z.number().optional(),
    scale: z.number().min(0.3).max(3).optional(),
  }),
]);
const mapDrawingsBodySchema = z.array(mapDrawingBodySchema).max(2000);

export async function updateMapDrawings(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = mapDrawingsBodySchema.parse(req.body);
  const result = await novelsService.updateMapDrawings(novel_id, req.user!.user_id, body);
  res.status(200).json(result);
}

export async function createMapVersion(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await novelsService.createMapVersion(novel_id, req.user!.user_id);
  res.status(201).json(result);
}

export async function listMapVersions(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await novelsService.listMapVersions(novel_id, req.user!.user_id);
  res.status(200).json(result);
}

const versionIdParamSchema = z.object({ version_id: z.string().uuid() });

export async function restoreMapVersion(req: Request, res: Response) {
  const { version_id } = versionIdParamSchema.parse(req.params);
  const result = await novelsService.restoreMapVersion(version_id, req.user!.user_id);
  res.status(200).json(result);
}

const characterRoleEnum = z.enum(["protagonist", "antagonist", "supporting"]);

const createCharacterBodySchema = z.object({
  character_name: z.string().trim().min(1).max(100),
  avatar_url: z.string().url().optional(),
  description: z.string().max(10000).optional(),
  character_role: characterRoleEnum.optional(),
  // เพิ่มภายหลัง (audit fix) — optional แล้ว: ไม่ส่งมา = ตัวละครยังไม่ถูกวางบนแคนวาส
  // (อยู่ในแถบ "รอวาง" ฝั่ง frontend จนกว่าจะกดวาง ซึ่งจะ PATCH ตำแหน่งจริงตามหลัง)
  position_x: z.number().optional(),
  position_y: z.number().optional(),
});

export async function createCharacterForNovel(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createCharacterBodySchema.parse(req.body);
  const node = await charactersService.createCharacterNode(novel_id, req.user!.user_id, body);
  res.status(201).json(node);
}

const createEdgeBodySchema = z.object({
  source_node_id: z.string().uuid(),
  target_node_id: z.string().uuid(),
  relationship_type: z.string().trim().max(50).optional(),
  edge_label: z.string().trim().max(100).optional(),
  description: z.string().max(10000).optional(),
  // เพิ่มภายหลัง (audit fix) — ผู้ใช้ขอเลือกรูปแบบเส้นได้ (ตรง/หักมุม/โค้ง)
  edge_type: z.enum(["default", "straight", "smoothstep"]).optional(),
});

export async function createCharacterEdgeForNovel(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createEdgeBodySchema.parse(req.body);

  if (body.source_node_id === body.target_node_id) {
    throw ApiError.unprocessable("A character cannot be linked to itself");
  }

  const edge = await charactersService.createCharacterEdge(novel_id, req.user!.user_id, body);
  res.status(201).json(edge);
}

const createLocationBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(10000).optional(),
  // เพิ่มภายหลัง (audit fix) — เดิมบังคับเป็น URL แต่ตอนนี้เก็บ "icon key" ของไอคอนสำเร็จรูป
  // (เช่น "castle") แทน ไม่ใช่ URL แล้ว — คลาย validation จาก .url() เป็น string ธรรมดา
  map_icon_url: z.string().trim().max(255).optional(),
  category: z.string().trim().max(50).optional(),
  // เพิ่มภายหลัง (audit fix) — optional แล้ว: ไม่ส่งมา = ยังไม่วางบนแคนวาส (อยู่ในแถบ "รอวาง")
  pos_x: z.number().optional(),
  pos_y: z.number().optional(),
});

export async function createLocationForNovel(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createLocationBodySchema.parse(req.body);
  const location = await locationsService.createLocation(novel_id, req.user!.user_id, body);
  res.status(201).json(location);
}

const createLocationEdgeBodySchema = z.object({
  source_location_id: z.string().uuid(),
  target_location_id: z.string().uuid(),
});

export async function createLocationEdgeForNovel(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createLocationEdgeBodySchema.parse(req.body);

  if (body.source_location_id === body.target_location_id) {
    throw ApiError.unprocessable("A location cannot be linked to itself");
  }

  const edge = await locationsService.createLocationEdge(novel_id, req.user!.user_id, body);
  res.status(201).json(edge);
}

const createTimelineEventBodySchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(10000).optional(),
  event_order: z.number().int(),
  event_date_in_story: z.string().trim().max(50).optional(),
  event_time: z.string().trim().max(20).optional(),
  thread: z.string().trim().max(100).optional(),
  color: z.string().trim().max(20).optional(),
  intensity: z.number().int().min(1).max(10).optional(),
});

export async function listDonors(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await novelsService.listNovelDonors(novel_id, req.user?.user_id);
  res.status(200).json(result);
}

export async function createTimelineEventForNovel(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createTimelineEventBodySchema.parse(req.body);
  const event = await timelineService.createTimelineEvent(novel_id, req.user!.user_id, body);
  res.status(201).json(event);
}

export async function listReviews(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const result = await novelsService.listNovelReviews(novel_id, req.user?.user_id);
  res.status(200).json(result);
}

const createReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment_text: z.string().trim().max(5000).optional(),
  is_anonymous: z.boolean().optional(),
});

export async function createReview(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createReviewBodySchema.parse(req.body);
  const review = await novelsService.createReview(novel_id, req.user!.user_id, body);
  res.status(201).json(review);
}
