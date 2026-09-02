export interface ManagedNovel {
  novel_id: string;
  title: string;
  synopsis: string | null;
  cover_image_url: string | null;
  status: "ongoing" | "completed" | "hiatus";
  visibility: "published" | "private" | "pending_review";
  legal_status: "original" | "fan-fiction" | "translation";
  format: "multi_chapter" | "one_shot";
  is_translated: boolean;
  content_rating: "all_ages" | "teen" | "mature";
  allow_donations: boolean;
  allow_screenshots: boolean;
  allow_comments: boolean;
  hide_like_count: boolean;
  primary_tag: { tag_id: number; name: string } | null;
  secondary_tag: { tag_id: number; name: string } | null;
  tags: { tag_id: number; name: string; category: string | null }[];
  author: { user_id: string; username: string };
}

export interface ManagedChapter {
  chapter_id: string;
  chapter_number: number;
  title: string;
  status: "draft" | "published" | "scheduled" | "hidden";
  word_count: number;
  published_at: string | null;
  scheduled_publish_at: string | null;
  updated_at: string | null;
}
