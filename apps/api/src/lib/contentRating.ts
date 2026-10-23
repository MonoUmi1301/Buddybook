import type { ContentRating } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";
import { ADULT_AGE, ageOn, type BirthDate } from "@/lib/ageVerification";

/** อายุขั้นต่ำของแต่ละเรต — all_ages เปิดให้ทุกคนรวมถึงคนที่ยังไม่ล็อกอิน/ยังไม่ยืนยันอายุ
 *  เรตอื่นต้องยืนยันอายุแล้วและอายุถึงเกณฑ์ (ยังไม่ยืนยัน = เห็นแค่ all_ages) */
export const RATING_MIN_AGE: Record<ContentRating, number> = { all_ages: 0, teen: 13, mature: 18 };

/** อายุที่ยืนยันแล้วของผู้ชม ณ วันนี้ — null = ไม่ได้ล็อกอินหรือยังไม่ยืนยันอายุ
 *  คำนวณจาก birth_date ทุกครั้ง (อายุ 17 ที่ยืนยันไว้จะปลดล็อก 18+ เองเมื่อถึงวันเกิด)
 *  บัญชีเก่าที่ age_verified=true แต่ไม่มี birth_date (ยืนยันก่อนมีคอลัมน์นี้) ถือว่า 18 */
export async function getViewerAge(viewer_id?: string): Promise<number | null> {
  if (!viewer_id) return null;
  const viewer = await prisma.user.findUnique({
    where: { user_id: viewer_id },
    select: { age_verified: true, birth_date: true },
  });
  if (!viewer) return null;
  if (viewer.birth_date) {
    const d = viewer.birth_date;
    return ageOn({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
  }
  return viewer.age_verified ? ADULT_AGE : null;
}

/** บันทึกวันเกิดที่ยืนยันแล้ว — age_verified (18+ ณ วันที่ยืนยัน) คงไว้ให้ส่วนที่ยังอ่าน boolean นี้ (session/หน้าเว็บ)
 *  แต่เกตเรตคำนวณจาก birth_date ใหม่ทุกครั้งผ่าน getViewerAge */
export async function saveVerifiedBirthDate(user_id: string, birth: BirthDate, source: "google" | "self_declared") {
  const age = ageOn(birth);
  await prisma.user.update({
    where: { user_id },
    data: {
      birth_date: new Date(Date.UTC(birth.year, birth.month - 1, birth.day)),
      age_verified: age >= ADULT_AGE,
      age_verification_source: source,
      updated_at: new Date(),
    },
  });
  return { age, age_verified: age >= ADULT_AGE, source };
}

export function canViewRating(rating: ContentRating, age: number | null): boolean {
  const min = RATING_MIN_AGE[rating];
  return min === 0 || (age !== null && age >= min);
}

/** เรตที่ผู้ชมอายุนี้เข้าถึงได้ — ใช้เป็น where ของ query รายการนิยาย (ค้นหา/แนะนำ/โปรไฟล์) */
export function allowedRatings(age: number | null): ContentRating[] {
  return (Object.keys(RATING_MIN_AGE) as ContentRating[]).filter((r) => canViewRating(r, age));
}

/** where clause กรองเรตตามอายุผู้ชม — เจ้าของ (scopedToOwn) เห็นผลงานตัวเองครบทุกเรต */
export async function contentRatingWhere(viewer_id: string | undefined, scopedToOwn = false) {
  if (scopedToOwn) return {};
  return { content_rating: { in: allowedRatings(await getViewerAge(viewer_id)) } };
}

/** เกตเรตเนื้อหาของทุก endpoint ที่คืนข้อมูลผูกกับนิยาย (ตัวนิยาย, ตอน, คอมเมนต์, รีวิว, ผู้สนับสนุน, ซื้อตอน)
 *  - ยังไม่ยืนยันอายุ → 403 AGE_VERIFICATION_REQUIRED (หน้าเว็บแสดงฟอร์มยืนยัน)
 *  - ยืนยันแล้วแต่อายุไม่ถึง → 403 AGE_RESTRICTED (ยืนยันซ้ำไม่ได้ ไม่ต้องแสดงฟอร์ม)
 *  เจ้าของนิยายผ่านเสมอ */
export async function assertContentRatingAllowed(
  novel: { content_rating: ContentRating },
  viewer_id: string | undefined,
  isOwner: boolean
) {
  if (isOwner || RATING_MIN_AGE[novel.content_rating] === 0) return;
  const age = await getViewerAge(viewer_id);
  if (canViewRating(novel.content_rating, age)) return;

  const required_age = RATING_MIN_AGE[novel.content_rating];
  if (age === null) {
    throw ApiError.forbidden(`ต้องยืนยันอายุ ${required_age} ปีขึ้นไปก่อนถึงจะดูนิยายเรื่องนี้ได้`, {
      code: "AGE_VERIFICATION_REQUIRED",
      required_age,
    });
  }
  throw ApiError.forbidden(`นิยายเรื่องนี้สำหรับผู้มีอายุ ${required_age} ปีขึ้นไป`, {
    code: "AGE_RESTRICTED",
    required_age,
  });
}
