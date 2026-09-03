import { z } from "zod";

/**
 * Zod schemas — validate request payload ฝั่ง Next.js "ก่อน" ส่งต่อไป Express Gateway
 * field/type อ้างอิงจาก API_Endpoints.md และ BuddyBook_Data_Dictionary_and_Schema.md
 * ทุกตัวในโฟลเดอร์ buddybook_real (ความยาว VARCHAR, ช่วงค่า enum ฯลฯ ต้องตรงกัน)
 */

const uuid = z.string().uuid();

// ---------------------------------------------------------------------------
// 1. Authentication & Onboarding
// ---------------------------------------------------------------------------

// เพิ่มภายหลัง (audit fix — ความปลอดภัยรหัสผ่าน) — mirror ของ apps/api/src/lib/passwordPolicy.ts
// ทุกตัวอักษร (คนละ app เรียก import ข้ามกันไม่ได้) ต้องแก้คู่กันเสมอถ้าจะเปลี่ยน policy
export const passwordSchema = z
  .string()
  .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
  .max(72, "รหัสผ่านต้องไม่เกิน 72 ตัวอักษร")
  .regex(/[a-z]/, "รหัสผ่านต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว")
  .regex(/[A-Z]/, "รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว")
  .regex(/[0-9]/, "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว")
  .regex(/[^A-Za-z0-9]/, "รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว (เช่น !@#$%^&*)");

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().email().max(255),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const verifyRegisterOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().length(6),
});

// เพิ่มภายหลัง (audit fix — 2FA) — ยืนยันขั้นที่สองตอนล็อกอิน (รหัสจากแอป Authenticator)
export const verifyLogin2faSchema = z.object({
  challenge_token: z.string().min(1),
  code: z.string().trim().length(6),
});

export const confirm2faSchema = z.object({
  secret: z.string().min(1),
  code: z.string().trim().length(6),
});

export const disable2faSchema = z.object({
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1).optional(),
});

export const logoutSchema = z.object({
  refresh_token: z.string().min(1).optional(),
});

export const deleteMeSchema = z.object({
  password: z.string().optional(),
});

export const updateMeSchema = z
  .object({
    username: z.string().trim().min(3).max(50).optional(),
    pen_name: z.string().trim().max(50).nullable().optional(),
    bio: z.string().max(2000).optional(),
    avatar_url: z.string().url().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const ageVerificationSchema = z.object({
  birth_date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "birth_date must be a valid date",
  }),
});

export const interestsSchema = z.object({
  tag_ids: z.array(z.number().int().positive()).min(1),
});

// ---------------------------------------------------------------------------
// 2. Reader Features
// ---------------------------------------------------------------------------

export const novelStatusEnum = z.enum(["ongoing", "completed", "hiatus"]);

export const novelsSearchQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
  field: z.enum(["all", "title", "author", "synopsis", "tag"]).optional(),
  // เพิ่มภายหลัง (Phase S, MASTER BRIEF) — เดิมรวมทุกกลุ่มเป็น tag_ids เดียว ตอนนี้แยกตาม category
  // ชัดเจน (genre_ids/pairing_ids/fandom_ids) ส่วน tag_ids เหลือไว้เฉพาะ "แท็กอื่นๆ" (freeform)
  genre_ids: z.string().optional(),
  sub_genre_ids: z.string().optional(),
  pairing_ids: z.string().optional(),
  fandom_ids: z.string().optional(),
  tag_ids: z.string().optional(),
  author: z.string().trim().max(100).optional(),
  status: novelStatusEnum.optional(),
  // อ้างอิงตรง ๆ ไม่ใช้ legalStatusEnum (ประกาศทีหลังในไฟล์นี้ อ้างถึงตอนนี้จะเจอ TDZ error)
  legal_status: z.enum(["original", "fan-fiction", "translation"]).optional(),
  // เพิ่มภายหลัง (Phase S) — ชื่อ param ตาม MASTER BRIEF ที่ผู้ใช้ระบุ แปลงเป็น legal_status
  // ภายในให้ (ไม่ผูก DB field ใหม่ซ้ำซ้อนกับของเดิมที่มีอยู่แล้ว)
  workType: z.enum(["original", "fanfiction"]).optional(),
  sort: z.enum(["newest", "views"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  // ส่วนขยายนอก API_Endpoints.md เดิม — ดูเหตุผลใน apps/api/src/modules/novels/novels.service.ts
  mine: z.coerce.boolean().optional(),
});

export const addToLibrarySchema = z.object({
  novel_id: uuid,
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  parent_comment_id: uuid.optional(),
});

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment_text: z.string().trim().max(5000).optional(),
  is_anonymous: z.boolean().optional(),
});

export const createDonationSchema = z.object({
  to_user_id: uuid,
  novel_id: uuid.optional(),
  amount: z.number().positive().max(999999.99),
  message: z.string().trim().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// 3. Writer Workspace
// ---------------------------------------------------------------------------

export const legalStatusEnum = z.enum(["original", "fan-fiction", "translation"]);
export const visibilityEnum = z.enum(["published", "private", "pending_review"]);
export const chapterStatusEnum = z.enum(["draft", "published", "scheduled", "hidden"]);
export const characterRoleEnum = z.enum(["protagonist", "antagonist", "supporting"]);
export const novelFormatEnum = z.enum(["multi_chapter", "one_shot"]);
export const contentRatingEnum = z.enum(["all_ages", "teen", "mature"]);

export const createNovelSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    synopsis: z.string().max(10000).optional(),
    cover_image_url: z.string().url().optional(),
    legal_status: legalStatusEnum,
    tag_ids: z.array(z.number().int().positive()).default([]),
    format: novelFormatEnum.optional(),
    is_translated: z.boolean().optional(),
    content_rating: contentRatingEnum.optional(),
    allow_donations: z.boolean().optional(),
    allow_screenshots: z.boolean().optional(),
    allow_comments: z.boolean().optional(),
    hide_like_count: z.boolean().optional(),
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

export const updateNovelSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    synopsis: z.string().max(10000).optional(),
    cover_image_url: z.string().url().optional(),
    status: novelStatusEnum.optional(),
    visibility: visibilityEnum.optional(),
    tag_ids: z.array(z.number().int().positive()).optional(),
    format: novelFormatEnum.optional(),
    is_translated: z.boolean().optional(),
    content_rating: contentRatingEnum.optional(),
    allow_donations: z.boolean().optional(),
    allow_screenshots: z.boolean().optional(),
    allow_comments: z.boolean().optional(),
    hide_like_count: z.boolean().optional(),
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

export const createChapterSchema = z
  .object({
    chapter_number: z.number().int().positive(),
    title: z.string().trim().min(1).max(255),
    content: z.string().optional(),
    status: chapterStatusEnum,
    scheduled_publish_at: z.coerce.date().optional(),
  })
  .refine((v) => v.status !== "scheduled" || (v.scheduled_publish_at && v.scheduled_publish_at > new Date()), {
    message: "scheduled_publish_at is required and must be in the future when status is scheduled",
    path: ["scheduled_publish_at"],
  });

export const updateChapterSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    content: z.string().optional(),
    status: chapterStatusEnum.optional(),
    scheduled_publish_at: z.coerce.date().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" })
  .refine((v) => v.status !== "scheduled" || (v.scheduled_publish_at && v.scheduled_publish_at > new Date()), {
    message: "scheduled_publish_at is required and must be in the future when status is scheduled",
    path: ["scheduled_publish_at"],
  });

export const autosaveChapterSchema = z.object({
  content_snapshot: z.string().min(1),
  // audit fix — เดิม autosave อัปเดตแค่ content ทำให้แก้ชื่อตอนแล้วรอ autosave (ไม่กด "บันทึกร่าง")
  // UI ขึ้น "บันทึกแล้ว" ทั้งที่ชื่อตอนจริงในฐานข้อมูลยังเป็นค่าเดิม — เพิ่ม title (optional) ให้ autosave
  // อัปเดตด้วยถ้ามีการแก้ไข
  title: z.string().trim().min(1).max(255).optional(),
});

export const createCharacterSchema = z.object({
  character_name: z.string().trim().min(1).max(100),
  avatar_url: z.string().url().optional(),
  description: z.string().max(10000).optional(),
  character_role: characterRoleEnum.optional(),
  // เพิ่มภายหลัง (audit fix) — optional แล้ว: ไม่ส่งมา = ยังไม่วางบนแคนวาส (อยู่ในแถบ "รอวาง")
  position_x: z.number().optional(),
  position_y: z.number().optional(),
});

export const updateCharacterSchema = z
  .object({
    character_name: z.string().trim().min(1).max(100).optional(),
    avatar_url: z.string().url().optional(),
    description: z.string().max(10000).optional(),
    character_role: characterRoleEnum.optional(),
    position_x: z.number().optional(),
    position_y: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

// หมายเหตุ: ไม่ refine self-loop (source_node_id !== target_node_id) ในนี้ — ทำใน route
// handler แทน เพื่อให้คุมได้ว่าตอบ 422 พร้อมข้อความตรงตาม API_Endpoints.md เป๊ะ ๆ
// (แยกจาก validation error ทั่วไปที่ตอบ 400)
const edgeTypeEnum = z.enum(["default", "straight", "smoothstep"]);

export const createCharacterEdgeSchema = z.object({
  source_node_id: uuid,
  target_node_id: uuid,
  relationship_type: z.string().trim().max(50).optional(),
  edge_label: z.string().trim().max(100).optional(),
  description: z.string().max(10000).optional(),
  // เพิ่มภายหลัง (audit fix) — ผู้ใช้ขอเลือกรูปแบบเส้นได้ (ตรง/หักมุม/โค้ง)
  edge_type: edgeTypeEnum.optional(),
});

export const updateCharacterEdgeSchema = z
  .object({
    relationship_type: z.string().trim().max(50).optional(),
    edge_label: z.string().trim().max(100).optional(),
    description: z.string().max(10000).optional(),
    edge_type: edgeTypeEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const createLocationEdgeSchema = z.object({
  source_location_id: uuid,
  target_location_id: uuid,
});

export const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(10000).optional(),
  // เพิ่มภายหลัง (audit fix) — เก็บ "icon key" ของไอคอนสำเร็จรูป (เช่น "castle") ไม่ใช่ URL แล้ว
  map_icon_url: z.string().trim().max(255).optional(),
  category: z.string().trim().max(50).optional(),
  // เพิ่มภายหลัง (audit fix) — optional แล้ว: ไม่ส่งมา = ยังไม่วางบนแคนวาส (อยู่ในแถบ "รอวาง")
  pos_x: z.number().optional(),
  pos_y: z.number().optional(),
});

export const updateLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(10000).optional(),
    map_icon_url: z.string().trim().max(255).optional(),
    category: z.string().trim().max(50).optional(),
    pos_x: z.number().optional(),
    pos_y: z.number().optional(),
    // เพิ่มภายหลัง (audit fix) — ย่อ-ขยาย/หมุน/พลิก/ลำดับซ้อนทับ + หมุดผูกฐานข้อมูล (lore link)
    scale: z.number().min(0.3).max(3).optional(),
    rotation: z.number().min(-360).max(360).optional(),
    flip_x: z.boolean().optional(),
    z_index: z.number().int().min(-1000).max(1000).optional(),
    linked_chapter_id: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const plotNotesSchema = z.object({
  intro: z.string().max(5000).optional(),
  twist: z.string().max(5000).optional(),
  elements: z.string().max(5000).optional(),
  realization: z.string().max(5000).optional(),
  resolution: z.string().max(5000).optional(),
  ending: z.string().max(5000).optional(),
});

export const themeNotesSchema = z.object({
  mainTheme: z.string().max(5000).optional(),
  symbol: z.string().max(5000).optional(),
  message: z.string().max(5000).optional(),
});

const mapPointSchema = z.object({ x: z.number(), y: z.number() });

export const mapDrawingsSchema = z.array(
  z.union([
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
    // เพิ่มภายหลัง (audit fix) — Land Tool: แปรงระบายพื้นที่ดินแบบเพิ่ม/ลบ (ต่างจาก "fill" เดิมที่
    // เป็นการลากปิดรูปทรงตรง ๆ) ดู WorldMap.tsx DrawingLayer สำหรับการ composite ผ่าน SVG mask
    z.object({
      id: z.string().min(1).max(100),
      kind: z.literal("land"),
      points: z.array(mapPointSchema).min(1).max(2000),
      brushSize: z.number().min(5).max(200),
      mode: z.enum(["add", "subtract"]),
      color: z.string().trim().max(20),
    }),
  ])
).max(2000);

export const createTimelineEventSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(10000).optional(),
  event_order: z.number().int(),
  event_date_in_story: z.string().trim().max(50).optional(),
  event_time: z.string().trim().max(20).optional(),
  thread: z.string().trim().max(100).optional(),
  color: z.string().trim().max(20).optional(),
  intensity: z.number().int().min(1).max(10).optional(),
});

export const updateTimelineEventSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(10000).optional(),
    event_order: z.number().int().optional(),
    event_date_in_story: z.string().trim().max(50).optional(),
    event_time: z.string().trim().max(20).optional(),
    thread: z.string().trim().max(100).optional(),
    color: z.string().trim().max(20).optional(),
    intensity: z.number().int().min(1).max(10).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

// ---------------------------------------------------------------------------
// 5. Admin & System Management
// ---------------------------------------------------------------------------

export const rejectNovelSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const userRoleEnum = z.enum(["admin", "user"]);

export const updateUserRoleSchema = z.object({
  role: userRoleEnum,
});

export const tagCategoryEnum = z.enum(["genre", "mood", "theme"]);

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  category: tagCategoryEnum.optional(),
});

export const updateTagSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    category: tagCategoryEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
});

// ---------------------------------------------------------------------------
// 6. Uploads (ส่วนขยายนอก API_Endpoints.md เดิม — Cloudinary signed upload)
// ---------------------------------------------------------------------------

export const uploadSignSchema = z.object({
  folder: z.enum(["covers", "avatars", "locations", "slips"]),
});

export const verifySlipSchema = z.object({
  package_id: z.string().min(1),
  slip_image_url: z.string().url(),
});

// เพิ่มภายหลัง (audit fix — เปลี่ยนมาใช้ Stripe) — สร้าง Checkout Session สำหรับแพ็กที่เลือก
export const createCheckoutSessionSchema = z.object({
  package_id: z.string().min(1),
});
