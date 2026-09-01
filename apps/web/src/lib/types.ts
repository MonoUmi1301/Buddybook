import type { TagColor } from "@/components/ui/Tag";

export interface NovelSummary {
  id: string;
  title: string;
  penName: string;
  coverImageUrl: string;
  synopsis?: string;
  /** ไม่มีทุก endpoint ที่คำนวณคะแนนเฉลี่ยจริง (เช่น GET /recommendations ที่มาจาก Neo4j
   *  ไม่ join Review) — ปล่อย undefined แล้วให้ NovelCard/RatingStars fallback เป็น 0 แทนการ
   *  บังคับทุกจุดต้องปลอมค่ามาใส่ */
  rating?: number;
  reviewCount?: number;
  viewCount: string;
  likeCount: string;
  chapterCount?: number;
  tags: { label: string; color: TagColor }[];
  href: string;
  updatedAt?: string;
}
