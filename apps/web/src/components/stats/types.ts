export interface NovelOverviewRow {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  visibility: "published" | "private" | "pending_review";
  views: number;
  views_7d: number;
  readers: number;
  likes: number;
  reviews: number;
  chapters: number;
  avg_rating: number | null;
  avg_polarity: number | null;
}

export interface NovelStats {
  novel: { novel_id: string; title: string; created_at: string };
  range_days: number;
  totals: {
    views: number;
    views_in_range: number;
    readers: number;
    likes: number;
    library_adds: number;
    reviews: number;
    avg_rating: number | null;
    comments: number;
    chapter_sales: number;
    chapter_sales_coins: number;
    gift_coins: number;
  };
  daily_views: { day: string; views: number }[];
  chapters: {
    chapter_id: string;
    chapter_number: number;
    title: string;
    status: string;
    views: number;
    comments: number;
    purchases: number;
    readers_reached: number;
  }[];
  sentiment: {
    counts: { pos: number; neg: number; neutral: number; pending: number };
    avg_polarity: number | null;
    weekly: { week_start: string; count: number; avg_polarity: number | null }[];
  };
  keywords: { positive: KeywordCount[]; negative: KeywordCount[]; all: KeywordCount[] };
}

export interface KeywordCount {
  term: string;
  count: number;
}

/** สีกราฟ — ผ่าน validator ของ dataviz (CVD/contrast) แล้ว; ข้อความใช้สีตัวอักษรปกติเสมอ ไม่ใช้สีซีรีส์ */
export const CHART = {
  single: "#F0803C", // primary-500 — ซีรีส์เดียว
  positive: "#2a78d6",
  negative: "#d0453c",
  neutral: "#b5b3ad",
} as const;

export function formatThaiShortDate(day: string): string {
  return new Date(`${day}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
