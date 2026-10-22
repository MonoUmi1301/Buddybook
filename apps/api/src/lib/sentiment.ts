import { prisma } from "@/lib/prisma";
import { syncReadEdge } from "@/lib/graphSync";

export type SentimentLabel = "pos" | "neg" | "neutral";

/**
 * gap 2.1 — แปลงผลของโมเดล (label + ความมั่นใจ 0..1) เป็นขั้วความรู้สึก −1..1 ตาม Proposal 3.2.2
 * ความมั่นใจสูงของ label "neg" ต้องได้ค่าติดลบมาก ไม่ใช่บวกมาก (บั๊กเดิมของระบบแนะนำ)
 */
export function toPolarity(label: SentimentLabel, confidence: number): number {
  const c = Math.min(1, Math.max(0, confidence));
  if (label === "pos") return c;
  if (label === "neg") return -c;
  return 0;
}

/** ดาว 1..5 → ขั้ว −1..1 (3 ดาว = 0) */
export function ratingPolarity(rating: number): number {
  return Math.min(1, Math.max(-1, (rating - 3) / 2));
}

/** น้ำหนักของข้อความ (ผลโมเดล) เทียบกับดาว ตอนผสมขั้วของรีวิว */
export const TEXT_WEIGHT = 0.5;

/**
 * ขั้วของรีวิวหลังผสมดาว — โมเดลอ่านรีวิวที่ทั้งชมทั้งติ (เช่น "โดยรวมดี แต่คำซ้ำเยอะ") แล้วได้บวกเกือบเต็ม
 * ดาวที่ผู้อ่านให้เองช่วยดึงให้ใกล้ความจริง: 4 ดาว + ข้อความ +0.95 → 0.5×0.95 + 0.5×0.5 = +0.725
 * ไม่มีดาว = ค่าดิบ ; ค่าดิบ (sentiment_polarity) เก็บแยกไว้เสมอเพื่อรายงาน/เทียบ
 */
export function blendReviewPolarity(textPolarity: number, rating: number | null | undefined): number {
  if (rating == null) return textPolarity;
  return TEXT_WEIGHT * textPolarity + (1 - TEXT_WEIGHT) * ratingPolarity(rating);
}

/** น้ำหนักของรีวิวเทียบกับคอมเมนต์ — รีวิวคือการตัดสินทั้งเรื่องโดยตรง ส่วนคอมเมนต์เป็นความเห็นรายตอน */
export const REVIEW_WEIGHT = 0.6;

/**
 * gap 2.2 — รวมขั้วความรู้สึกของ user ต่อนิยาย 1 เรื่อง จากรีวิว (ถ้ามี) และคอมเมนต์ทุกตอนของเรื่องนั้น
 * คืน null เมื่อยังไม่มีข้อมูลที่วิเคราะห์แล้วเลย (กราฟจะคง sentiment_score เดิมไว้ ไม่เขียนทับเป็น 0)
 */
export function combinePolarity(reviewPolarity: number | null, commentPolarities: number[]): number | null {
  const commentMean =
    commentPolarities.length > 0 ? commentPolarities.reduce((a, b) => a + b, 0) / commentPolarities.length : null;
  if (reviewPolarity === null && commentMean === null) return null;
  if (reviewPolarity === null) return commentMean;
  if (commentMean === null) return reviewPolarity;
  return REVIEW_WEIGHT * reviewPolarity + (1 - REVIEW_WEIGHT) * commentMean;
}

/** คำนวณขั้วรวมจาก Postgres แล้วอัปเดต READ edge ใน Neo4j — เรียกหลังผล sentiment ของรีวิว/คอมเมนต์กลับมา */
export async function refreshReadEdgeSentiment(user_id: string, novel_id: string) {
  const [review, comments] = await Promise.all([
    prisma.review.findUnique({
      where: { novel_id_user_id: { novel_id, user_id } },
      select: { blended_polarity: true },
    }),
    prisma.comment.findMany({
      where: { user_id, sentiment_polarity: { not: null }, chapter: { novel_id } },
      select: { sentiment_polarity: true },
    }),
  ]);
  const polarity = combinePolarity(
    review?.blended_polarity ?? null,
    comments.map((c) => c.sentiment_polarity as number)
  );
  await syncReadEdge(user_id, novel_id, polarity);
  return polarity;
}
