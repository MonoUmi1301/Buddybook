import type { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { syncInterestedIn, deleteUserGraphNode } from "@/lib/graphSync";

/** Reference implementation ที่สอง — แสดง pattern การใช้ req.user จาก requireAuth */
export async function getMe(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { user_id: req.user!.user_id },
    select: {
      user_id: true,
      username: true,
      pen_name: true,
      email: true,
      role: true,
      avatar_url: true,
      bio: true,
      age_verified: true,
      totp_enabled: true,
      created_at: true,
      password_hash: true,
      _count: { select: { user_interests: true } },
    },
  });

  if (!user) throw ApiError.notFound("User not found");

  const { _count, password_hash, ...rest } = user;
  // audit fix — หน้า "ลบบัญชี" ต้องรู้ว่าบัญชีนี้ตั้งรหัสผ่านไว้หรือเป็น OAuth-only ล้วน ๆ ถึงจะ
  // โชว์ช่องกรอกรหัสผ่านยืนยันถูก — ส่งแค่ boolean ไปเท่านั้น ไม่เคยส่ง hash จริงออกไปฝั่ง client
  res.status(200).json({ ...rest, has_interests: _count.user_interests > 0, has_password: Boolean(password_hash) });
}

const updateMeBodySchema = z
  .object({
    username: z.string().trim().min(3).max(50).optional(),
    // เพิ่มภายหลัง (audit fix) — นามปากกาที่นักอ่านเห็นบนหน้านิยาย/ตอน แยกจาก username
    // ส่งสตริงว่างมาเพื่อล้างกลับไปใช้ username แทนได้ (nullable ผ่าน .nullable() ด้านล่าง)
    pen_name: z.string().trim().max(50).nullable().optional(),
    bio: z.string().max(2000).optional(),
    avatar_url: z.string().url().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export async function updateMe(req: Request, res: Response) {
  const body = updateMeBodySchema.parse(req.body);
  // pen_name ว่างเปล่า = ล้างค่ากลับไป fallback ใช้ username ตอนแสดงผล
  const data = { ...body, pen_name: body.pen_name?.trim() === "" ? null : body.pen_name };

  try {
    const user = await prisma.user.update({
      where: { user_id: req.user!.user_id },
      data: { ...data, updated_at: new Date() },
      select: {
        user_id: true,
        username: true,
        pen_name: true,
        email: true,
        role: true,
        avatar_url: true,
        bio: true,
        age_verified: true,
        updated_at: true,
      },
    });

    res.status(200).json(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("ชื่อผู้ใช้นี้มีคนใช้แล้ว กรุณาเลือกชื่ออื่น");
    }
    throw err;
  }
}

const deleteMeBodySchema = z.object({
  // มีค่าเฉพาะบัญชีที่ตั้งรหัสผ่านไว้ (ไม่ใช่ OAuth-only) — บังคับกรอกรหัสผ่านซ้ำก่อนลบบัญชี
  // กันกรณี session ถูกขโมย (เช่น XSS) แล้วสั่งลบบัญชีแทนเจ้าของโดยไม่รู้รหัสผ่านจริง
  password: z.string().optional(),
});

/** Reference implementation — DELETE /users/me (audit fix)
 *  ไม่ hard-delete แถวจริง (ลบไม่ได้อยู่แล้วเพราะ Review/Comment/Donation ไม่ได้ตั้ง onDelete
 *  cascade ไว้ — ลบ user ที่เคยรีวิว/คอมเมนต์ที่ไหนจะชน FK constraint ทันที) แทนที่ด้วยการ
 *  "anonymize" ล้างข้อมูลระบุตัวตนทั้งหมดแต่คงแถวไว้ ตามที่เว็บใหญ่ ๆ ทำกัน (Reddit/Twitter
 *  แสดง "[deleted]" แทนชื่อเดิม) เพื่อไม่ให้รีวิว/คอมเมนต์ของคนอื่นที่พาดพิงถึง broken —
 *  ตรวจจับบัญชีที่ถูกลบแล้วด้วย password_hash=null AND oauth_id=null พร้อมกัน (สถานะที่เป็นไป
 *  ไม่ได้สำหรับบัญชีปกติ เพราะ register ต้องมีอย่างใดอย่างหนึ่งเสมอ) ไม่ต้องเพิ่มคอลัมน์ deleted_at ใหม่
 *  ฝั่ง Neo4j ลบ node เต็มรูปแบบได้เลยเพราะ INTERESTED_IN/READ เป็นข้อมูลส่วนตัวล้วน ๆ ไม่กระทบคนอื่น */
export async function deleteMe(req: Request, res: Response) {
  const { password } = deleteMeBodySchema.parse(req.body);
  const user_id = req.user!.user_id;

  const user = await prisma.user.findUnique({
    where: { user_id },
    select: { password_hash: true },
  });
  if (!user) throw ApiError.notFound("User not found");

  if (user.password_hash) {
    if (!password) throw ApiError.badRequest("กรุณากรอกรหัสผ่านเพื่อยืนยันการลบบัญชี");
    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) throw ApiError.unauthorized("รหัสผ่านไม่ถูกต้อง");
  }

  await prisma.user.update({
    where: { user_id },
    data: {
      username: `ผู้ใช้ที่ถูกลบ_${user_id.slice(0, 8)}`,
      email: `deleted+${user_id}@buddybook.invalid`,
      password_hash: null,
      oauth_provider: null,
      oauth_id: null,
      avatar_url: null,
      bio: null,
      updated_at: new Date(),
    },
  });

  deleteUserGraphNode(user_id).catch((err) => console.error("Neo4j deleteUserGraphNode failed:", err));

  res.status(204).send();
}

const ageVerificationBodySchema = z.object({
  birth_date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "birth_date must be a valid date",
  }),
});

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** age_verified ใช้เปิด/ปิดการเข้าถึงเนื้อหา 18+ — ต้องคำนวณอายุจริงจาก birth_date
 *  ไม่ใช่ตั้งเป็น true ทันทีที่กรอกวันเกิดมา (ผู้ใช้อายุต่ำกว่า 18 จะได้ age_verified=false) */
export async function setAgeVerification(req: Request, res: Response) {
  const { birth_date } = ageVerificationBodySchema.parse(req.body);
  const age = Math.floor((Date.now() - new Date(birth_date).getTime()) / MS_PER_YEAR);
  const age_verified = age >= 18;

  await prisma.user.update({
    where: { user_id: req.user!.user_id },
    data: { age_verified, updated_at: new Date() },
  });

  res.status(200).json({ age_verified });
}

const interestsBodySchema = z.object({
  tag_ids: z.array(z.number().int().positive()).min(1),
});

const userIdParamSchema = z.object({ user_id: z.string().uuid() });

/** Reference implementation — GET /users/:user_id (Public, ส่วนขยายนอก API_Endpoints.md เดิม
 *  ที่มีแค่ GET /users/me — หน้าโปรไฟล์สาธารณะต้องมี endpoint แยกที่ไม่โยงกับ req.user) */
export async function getPublicProfile(req: Request, res: Response) {
  const { user_id } = userIdParamSchema.parse(req.params);

  const user = await prisma.user.findUnique({
    where: { user_id },
    select: { user_id: true, username: true, pen_name: true, avatar_url: true, bio: true, created_at: true },
  });
  if (!user) throw ApiError.notFound("User not found");

  const novels = await prisma.novel.findMany({
    where: { author_id: user_id, visibility: "published" },
    orderBy: { created_at: "desc" },
    select: {
      novel_id: true,
      title: true,
      cover_image_url: true,
      view_count: true,
      status: true,
    },
  });

  res.status(200).json({
    ...user,
    novel_count: novels.length,
    novels: novels.map((n) => ({ ...n, view_count: Number(n.view_count) })),
  });
}

export async function setInterests(req: Request, res: Response) {
  const { tag_ids } = interestsBodySchema.parse(req.body);
  const user_id = req.user!.user_id;

  await prisma.userInterest.createMany({
    data: tag_ids.map((tag_id) => ({ user_id, tag_id })),
    skipDuplicates: true,
  });

  const [user_interests, user] = await Promise.all([
    prisma.userInterest.findMany({
      where: { user_id },
      select: { tag: { select: { tag_id: true, name: true } } },
    }),
    prisma.user.findUnique({ where: { user_id }, select: { username: true } }),
  ]);

  // sync ไป Neo4j (INTERESTED_IN) หลัง Postgres commit สำเร็จแล้ว — แก้ cold-start ของ
  // recommendation system ตามที่ระบุใน Proposal_montira.docx บทที่ 1
  if (user) {
    syncInterestedIn(
      user_id,
      user.username,
      user_interests.map((ui) => ui.tag.name)
    ).catch((err) => console.error("Neo4j syncInterestedIn failed:", err));
  }

  res.status(201).json({ user_interests: user_interests.map((ui) => ui.tag) });
}
