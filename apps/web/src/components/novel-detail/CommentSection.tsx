"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smile } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface CommentNode {
  comment_id: string;
  user: { user_id: string; username: string; avatar_url: string | null };
  content: string;
  sentiment_label: "pos" | "neg" | "neutral" | null;
  created_at: string;
  replies: CommentNode[];
}

interface CommentSectionProps {
  chapterId: string;
  comments: CommentNode[];
  isLoggedIn: boolean;
}

function CommentRow({ node, depth = 0 }: { node: CommentNode; depth?: number }) {
  return (
    <li className={cn("flex gap-3", depth > 0 && "ml-10 mt-3")}>
      <Avatar src={node.user.avatar_url ?? undefined} alt={node.user.username} size="sm" />
      <div className="flex-1">
        <div className="rounded-lg bg-neutral-50 px-4 py-2.5">
          <p className="text-sm font-medium text-neutral-800">{node.user.username}</p>
          <p className="text-sm text-neutral-600">{node.content}</p>
        </div>
        {node.replies.length > 0 && (
          <ul>
            {node.replies.map((reply) => (
              <CommentRow key={reply.comment_id} node={reply} depth={depth + 1} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/** กล่องคอมเมนต์ + รายการ (รองรับ reply ซ้อนกัน) ต่อกับ GET/POST /chapters/:id/comments จริง
 *  ดู wf_novel_detail.png (ตอนนี้ผูกกับหน้าอ่านตอนแทนหน้ารายละเอียดนิยาย — คอมเมนต์เป็นราย
 *  ตอน ไม่ใช่รายนิยาย ตาม data dictionary) */
export function CommentSection({ chapterId, comments: initialComments, isLoggedIn }: CommentSectionProps) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [sort, setSort] = useState<"top" | "latest">("top");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);
  const sorted = sort === "latest" ? [...comments].reverse() : comments;

  async function handleSubmit() {
    if (!value.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/chapters/${chapterId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setComments((prev) => [
          ...prev,
          {
            comment_id: json.comment_id,
            user: { user_id: "", username: "คุณ", avatar_url: null },
            content: json.content,
            sentiment_label: null,
            created_at: json.created_at,
            replies: [],
          },
        ]);
        setValue("");
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-h3 text-neutral-900">คอมเมนต์ ({totalCount})</h2>

      {isLoggedIn && (
        <div className="rounded-card border border-neutral-200 bg-white p-4">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            placeholder="เขียนคอมเมนต์ที่นี่"
            className="w-full resize-none border-0 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
            <button type="button" aria-label="อีโมจิ" className="text-2xl leading-none">
              <Smile className="h-6 w-6 text-neutral-400 hover:text-neutral-600" />
            </button>
            <Button variant="primary" disabled={!value.trim()} loading={submitting} onClick={handleSubmit}>
              ส่งคอมเมนต์
            </Button>
          </div>
        </div>
      )}

      {comments.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-neutral-500">จัดเรียงตาม</span>
          <button
            type="button"
            onClick={() => setSort("top")}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
              sort === "top" ? "bg-primary-500 text-white" : "border border-neutral-300 text-neutral-600"
            )}
          >
            เก่าสุด
          </button>
          <button
            type="button"
            onClick={() => setSort("latest")}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
              sort === "latest" ? "bg-primary-500 text-white" : "border border-neutral-300 text-neutral-600"
            )}
          >
            ล่าสุด
          </button>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">ยังไม่มีคอมเมนต์ เป็นคนแรกที่แสดงความเห็นสิ!</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {sorted.map((c) => (
            <CommentRow key={c.comment_id} node={c} />
          ))}
        </ul>
      )}
    </section>
  );
}
