import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";
import { StatPill } from "@/components/ui/StatPill";

export interface SearchNovelItem {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  status: "ongoing" | "completed" | "hiatus";
  view_count: number;
}

const statusLabel: Record<SearchNovelItem["status"], string> = {
  ongoing: "กำลังเขียน",
  completed: "จบแล้ว",
  hiatus: "พักการเขียน",
};

/**
 * การ์ดผลค้นหาแนวนอน — ต่อกับ GET /novels/search จริง (novels.service.ts) จึงมีแค่
 * field ที่ endpoint นี้คืนจริง (title/cover/status/view_count) ไม่มี rating/แท็ก/ยอดไลก์
 * เหมือนดีไซน์ต้นฉบับ เพราะ endpoint จริงยังไม่ join ข้อมูลพวกนั้น ดู wf_empty_states.png
 */
export function SearchResultCard({ novel }: { novel: SearchNovelItem }) {
  return (
    <Link
      href={`/novels/${novel.novel_id}`}
      className="flex gap-4 rounded-card border border-neutral-200 bg-white p-3 transition-shadow hover:shadow-md"
    >
      <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        {novel.cover_image_url && (
          <Image src={novel.cover_image_url} alt={novel.title} fill sizes="96px" className="object-cover" />
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-1">
        <h3 className="line-clamp-1 text-sm font-semibold text-neutral-900">{novel.title}</h3>
        <p className="text-xs font-medium text-primary-500">{statusLabel[novel.status]}</p>
        <StatPill icon={Eye} value={novel.view_count} />
      </div>
    </Link>
  );
}
