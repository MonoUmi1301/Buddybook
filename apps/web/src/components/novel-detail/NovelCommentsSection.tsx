import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { CommentNode } from "@/components/novel-detail/CommentSection";

export interface ChapterCommentGroup {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  comments: CommentNode[];
}

interface NovelCommentsSectionProps {
  novelId: string;
  groups: ChapterCommentGroup[];
}

function countComments(comments: CommentNode[]): number {
  return comments.reduce((sum, c) => sum + 1 + countComments(c.replies), 0);
}

function CommentRow({ node }: { node: CommentNode }) {
  return (
    <li className="flex gap-3">
      <Avatar src={node.user.avatar_url ?? undefined} alt={node.user.username} size="sm" />
      <div className="flex-1">
        <div className="rounded-lg bg-neutral-50 px-4 py-2.5">
          <p className="text-sm font-medium text-neutral-800">{node.user.username}</p>
          <p className="text-sm text-neutral-600">{node.content}</p>
        </div>
        {node.replies.length > 0 && (
          <ul className="ml-10 mt-3 space-y-3">
            {node.replies.map((reply) => (
              <CommentRow key={reply.comment_id} node={reply} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/** รวมคอมเมนต์จากทุกตอนที่เผยแพร่แล้วของนิยายเรื่องนี้มาแสดงในหน้ารายละเอียด — backend ไม่มี
 *  endpoint รวมระดับนิยาย คอมเมนต์ผูกกับตอนเสมอ (ดู CommentSection.tsx) หน้านี้จึงแค่แสดงผลรวม
 *  แบบอ่านอย่างเดียว ต้องกดเข้าไปที่ตอนนั้น ๆ ถึงจะคอมเมนต์ได้ */
export function NovelCommentsSection({ novelId, groups }: NovelCommentsSectionProps) {
  const totalCount = groups.reduce((sum, g) => sum + countComments(g.comments), 0);
  const nonEmptyGroups = groups.filter((g) => g.comments.length > 0);

  return (
    <section className="rounded-card border border-neutral-200 bg-white p-6">
      <h2 className="mb-3 text-h3 text-neutral-900">คอมเมนต์ทั้งหมด ({totalCount})</h2>
      {nonEmptyGroups.length === 0 ? (
        <p className="text-sm text-neutral-400">ยังไม่มีคอมเมนต์ในนิยายเรื่องนี้ กดเข้าไปอ่านแล้วเป็นคนแรกที่คอมเมนต์สิ!</p>
      ) : (
        <div className="space-y-6">
          {nonEmptyGroups.map((g) => (
            <div key={g.chapterId}>
              <Link
                href={`/novels/${novelId}/chapters/${g.chapterId}`}
                className="text-sm font-medium text-primary-600 hover:underline"
              >
                ตอนที่ {g.chapterNumber}: {g.chapterTitle}
              </Link>
              <ul className="mt-2 space-y-3">
                {g.comments.map((c) => (
                  <CommentRow key={c.comment_id} node={c} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
