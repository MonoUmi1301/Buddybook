"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ReportButton } from "@/components/social/ReportButton";
import { SelectedStickerPreview, StickerImage, StickerPicker } from "@/components/social/StickerPicker";
import type { StickerId } from "@/lib/stickers";
import { handleAsync } from "@/lib/handleAsync";

export interface CommentNode {
  comment_id: string;
  user: { user_id: string; username: string; avatar_url: string | null };
  content: string;
  sticker_id: string | null;
  sentiment_label: "pos" | "neg" | "neutral" | null;
  created_at: string;
  replies: CommentNode[];
}

interface CommentSectionProps {
  chapterId: string;
  comments: CommentNode[];
  isLoggedIn: boolean;
}

// ตอบกลับซ้อนได้ถึงชั้นนี้ ลึกกว่านี้ซ่อนปุ่มตอบกลับ (เยื้องซ้อนต่อไปจะแคบจนอ่านไม่ได้บนมือถือ)
const MAX_REPLY_DEPTH = 2;

/** เพิ่ม reply เข้าไปใต้คอมเมนต์ parent ในต้นไม้ (immutable) */
function insertReply(nodes: CommentNode[], parentId: string, reply: CommentNode): CommentNode[] {
  return nodes.map((n) =>
    n.comment_id === parentId
      ? { ...n, replies: [...n.replies, reply] }
      : n.replies.length
        ? { ...n, replies: insertReply(n.replies, parentId, reply) }
        : n
  );
}

function countNodes(nodes: CommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.replies), 0);
}

type PostComment = (input: { content: string; sticker_id: StickerId | null; parent_comment_id?: string }) => Promise<boolean>;

/** ช่องเขียนคอมเมนต์ — ใช้ทั้งคอมเมนต์หลักและกล่องตอบกลับใต้คอมเมนต์ */
function CommentComposer({
  onPost,
  parentId,
  placeholder,
  submitLabel,
  autoFocus,
  onCancel,
  compact,
}: {
  onPost: PostComment;
  parentId?: string;
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [value, setValue] = useState("");
  const [stickerId, setStickerId] = useState<StickerId | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!value.trim() && !stickerId) return;
    setSubmitting(true);
    try {
      const ok = await onPost({ content: value.trim(), sticker_id: stickerId, parent_comment_id: parentId });
      if (ok) {
        setValue("");
        setStickerId(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("rounded-card border border-neutral-200 bg-white", compact ? "p-3" : "p-4")}>
      <SelectedStickerPreview id={stickerId} onRemove={() => setStickerId(null)} />
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={compact ? 2 : 3}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Escape" && onCancel) onCancel();
        }}
        className="w-full resize-none border-0 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
      />
      <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
        <StickerPicker value={stickerId} onChange={setStickerId} />
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              ยกเลิก
            </Button>
          )}
          <Button variant="primary" disabled={!value.trim() && !stickerId} loading={submitting} onClick={handleAsync(handleSubmit)}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  node,
  depth = 0,
  isLoggedIn,
  replyingTo,
  setReplyingTo,
  onPost,
}: {
  node: CommentNode;
  depth?: number;
  isLoggedIn: boolean;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  onPost: PostComment;
}) {
  const isReplying = replyingTo === node.comment_id;
  return (
    <li className={cn("flex gap-3", depth > 0 && "mt-3")}>
      <Avatar src={node.user.avatar_url ?? undefined} alt={node.user.username} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-neutral-50 px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-neutral-800">{node.user.username}</p>
            <ReportButton targetType="comment" targetId={node.comment_id} isLoggedIn={isLoggedIn} variant="icon" />
          </div>
          {node.content && <p className="whitespace-pre-line break-words text-sm text-neutral-600">{node.content}</p>}
          <StickerImage id={node.sticker_id} className="mt-1 h-28 w-28" />
        </div>
        {isLoggedIn && depth < MAX_REPLY_DEPTH && (
          <button
            type="button"
            onClick={() => setReplyingTo(isReplying ? null : node.comment_id)}
            aria-expanded={isReplying}
            className="ml-4 mt-1 text-xs font-medium text-neutral-500 hover:text-primary-600"
          >
            ตอบกลับ
          </button>
        )}
        {isReplying && (
          <div className="mt-2">
            <CommentComposer
              compact
              autoFocus
              onPost={async (input) => {
                const ok = await onPost(input);
                if (ok) setReplyingTo(null);
                return ok;
              }}
              parentId={node.comment_id}
              placeholder={`ตอบกลับ ${node.user.username}`}
              submitLabel="ตอบกลับ"
              onCancel={() => setReplyingTo(null)}
            />
          </div>
        )}
        {node.replies.length > 0 && (
          <ul>
            {node.replies.map((reply) => (
              <CommentRow
                key={reply.comment_id}
                node={reply}
                depth={depth + 1}
                isLoggedIn={isLoggedIn}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                onPost={onPost}
              />
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
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const totalCount = countNodes(comments);
  const sorted = sort === "latest" ? [...comments].reverse() : comments;

  const postComment: PostComment = async ({ content, sticker_id, parent_comment_id }) => {
    const res = await fetch(`/api/v1/chapters/${chapterId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, sticker_id: sticker_id ?? undefined, parent_comment_id }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const node: CommentNode = {
      comment_id: json.comment_id,
      user: { user_id: "", username: "คุณ", avatar_url: null },
      content: json.content,
      sticker_id: json.sticker_id ?? null,
      sentiment_label: null,
      created_at: json.created_at,
      replies: [],
    };
    setComments((prev) => (parent_comment_id ? insertReply(prev, parent_comment_id, node) : [...prev, node]));
    router.refresh();
    return true;
  };

  return (
    <section>
      <h2 className="mb-3 text-h3 text-neutral-900">คอมเมนต์ ({totalCount})</h2>

      {isLoggedIn && <CommentComposer onPost={postComment} placeholder="เขียนคอมเมนต์ที่นี่" submitLabel="ส่งคอมเมนต์" />}

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
            <CommentRow
              key={c.comment_id}
              node={c}
              isLoggedIn={isLoggedIn}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              onPost={postComment}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
