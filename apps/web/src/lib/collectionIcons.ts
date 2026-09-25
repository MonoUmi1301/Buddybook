import {
  Coffee,
  Feather,
  Flame,
  Ghost,
  Heart,
  Leaf,
  Library,
  Moon,
  Music,
  Sparkles,
  Star,
  Sun,
  Swords,
  Waves,
  type LucideIcon,
} from "lucide-react";

/**
 * เปลี่ยนภายหลัง (เลิกใช้อีโมจิ) — ไอคอนชั้นหนังสือเป็นชุดคงที่ วาดด้วยไอคอนของเว็บ (lucide)
 * key ต้องตรงกับ COLLECTION_ICONS ใน apps/api/src/modules/collections/collections.service.ts
 */
export const COLLECTION_ICONS = [
  "books",
  "heart",
  "star",
  "moon",
  "sun",
  "coffee",
  "waves",
  "leaf",
  "flame",
  "ghost",
  "swords",
  "sparkles",
  "feather",
  "music",
] as const;

export type CollectionIcon = (typeof COLLECTION_ICONS)[number];

export const collectionIconMeta: Record<CollectionIcon, { Icon: LucideIcon; label: string }> = {
  books: { Icon: Library, label: "หนังสือ" },
  heart: { Icon: Heart, label: "หัวใจ" },
  star: { Icon: Star, label: "ดาว" },
  moon: { Icon: Moon, label: "พระจันทร์" },
  sun: { Icon: Sun, label: "พระอาทิตย์" },
  coffee: { Icon: Coffee, label: "กาแฟ" },
  waves: { Icon: Waves, label: "ทะเล" },
  leaf: { Icon: Leaf, label: "ใบไม้" },
  flame: { Icon: Flame, label: "ไฟ" },
  ghost: { Icon: Ghost, label: "ผี" },
  swords: { Icon: Swords, label: "ดาบ" },
  sparkles: { Icon: Sparkles, label: "ประกาย" },
  feather: { Icon: Feather, label: "ขนนก" },
  music: { Icon: Music, label: "ดนตรี" },
};

export function isCollectionIcon(value: string | null | undefined): value is CollectionIcon {
  return !!value && (COLLECTION_ICONS as readonly string[]).includes(value);
}
