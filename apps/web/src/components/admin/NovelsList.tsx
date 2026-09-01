"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuickAddPopover } from "@/components/writer/QuickAddPopover";

export interface AdminPendingNovel {
  novel_id: string;
  title: string;
  legal_status: string;
  cover_image_url: string | null;
  author: { user_id: string; username: string };
}

const legalStatusLabel: Record<string, string> = {
  original: "ต้นฉบับ",
  fan_fiction: "แฟนฟิค",
  translation: "แปล",
};

interface NovelsListProps {
  initialNovels: AdminPendingNovel[];
}

// PATCH /admin/novels/:novel_id/approve|reject — ดู API_Endpoints.md ส่วนที่ 5
export function NovelsList({ initialNovels }: NovelsListProps) {
  const [novels, setNovels] = useState<AdminPendingNovel[]>(initialNovels);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function approve(id: string) {
    setPendingAction(id);
    const res = await fetch(`/api/v1/admin/novels/${id}/approve`, { method: "PATCH" });
    if (res.ok) setNovels((ns) => ns.filter((n) => n.novel_id !== id));
    setPendingAction(null);
  }

  async function reject(id: string, reason: string) {
    setPendingAction(id);
    const res = await fetch(`/api/v1/admin/novels/${id}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) setNovels((ns) => ns.filter((n) => n.novel_id !== id));
    setPendingAction(null);
  }

  if (novels.length === 0) {
    return <EmptyState title="ไม่มีนิยายรอตรวจสอบในตอนนี้" size="sm" />;
  }

  return (
    <ul className="space-y-3">
      {novels.map((n) => (
        <li
          key={n.novel_id}
          className="flex items-center gap-4 rounded-card border border-neutral-200 p-3"
        >
          <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
            {n.cover_image_url && (
              <Image src={n.cover_image_url} alt={n.title} fill sizes="64px" className="object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">{n.title}</p>
            <p className="text-xs text-neutral-500">โดย {n.author.username}</p>
            <span className="mt-1 inline-block rounded-pill bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
              {legalStatusLabel[n.legal_status] ?? n.legal_status}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <QuickAddPopover placeholder="เหตุผลที่ปฏิเสธ" onSubmit={(reason) => reject(n.novel_id, reason)}>
              {(open) => (
                <Button
                  variant="outline"
                  size="sm"
                  loading={pendingAction === n.novel_id}
                  onClick={open}
                  className="border-red-300 text-red-500 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                  ปฏิเสธ
                </Button>
              )}
            </QuickAddPopover>
            <Button
              variant="primary"
              size="sm"
              loading={pendingAction === n.novel_id}
              onClick={() => approve(n.novel_id)}
            >
              <Check className="h-4 w-4" />
              อนุมัติ
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
