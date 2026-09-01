import { prisma } from "@/lib/prisma";

/** ใช้ร่วมกันโดย getNovelById (novels.service.ts) และ getChapterById (chapters.service.ts) —
 *  แยกออกมาเป็น shared helper เพื่อไม่ให้เกตอายุ 18+ ของทั้งสอง endpoint เพี้ยนไม่ตรงกัน
 *  (เดิม getChapterById ไม่เช็ค content_rating เลย อ่านเนื้อหาตอนตรง ๆ ได้แม้นิยายจะถูกบล็อกจาก
 *  หน้ารายละเอียดนิยายแล้วก็ตาม ถ้ารู้/เดา chapter_id ได้) */
export async function isViewerAgeVerified(viewer_id?: string): Promise<boolean> {
  if (!viewer_id) return false;
  const viewer = await prisma.user.findUnique({ where: { user_id: viewer_id }, select: { age_verified: true } });
  return viewer?.age_verified ?? false;
}
