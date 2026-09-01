import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface ChapterListItem {
  chapter_id: string;
  chapter_number: number;
  title: string;
  status: "draft" | "published";
}

interface ChapterListCardProps {
  novelId: string;
  chapters: ChapterListItem[];
}

/** การ์ดสารบัญตอน — แถบสีส้ม "สารบัญ N ตอน" ใน wf_novel_detail.png — ลิงก์ไปหน้าอ่านจริงแล้ว */
export function ChapterListCard({ novelId, chapters }: ChapterListCardProps) {
  return (
    <section className="overflow-hidden rounded-card border border-neutral-200 bg-white">
      <div className="bg-primary-500 px-6 py-3">
        <h2 className="text-h3 text-white">สารบัญ {chapters.length} ตอน</h2>
      </div>
      {chapters.length === 0 ? (
        <p className="px-6 py-4 text-sm text-neutral-400">ยังไม่มีตอนที่เผยแพร่</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {chapters.map((ch) => (
            <li key={ch.chapter_id}>
              <Link
                href={`/novels/${novelId}/chapters/${ch.chapter_id}`}
                className="flex items-center justify-between px-6 py-3 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-primary-600"
              >
                <span>
                  ตอนที่ {ch.chapter_number} {ch.title}
                </span>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
