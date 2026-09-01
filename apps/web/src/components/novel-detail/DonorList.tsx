"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { DonateModal } from "@/components/novel-detail/DonateModal";

export interface Donor {
  user: { user_id: string; username: string; avatar_url: string | null };
  total_coins: number;
}

interface DonorListProps {
  novelId: string;
  authorId: string;
  authorUsername: string;
  donors: Donor[];
  isLoggedIn: boolean;
}

/** การ์ด "โดเนทนักเขียน" — ต่อกับ GET/POST /novels/:id/donations จริงแล้ว ดู wf_novel_detail.png */
export function DonorList({ novelId, authorId, authorUsername, donors, isLoggedIn }: DonorListProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-card border border-neutral-200 bg-white p-6">
      <h2 className="text-h3 text-neutral-900">โดเนทนักเขียน</h2>
      <p className="mb-4 text-sm font-medium text-primary-500">ผู้สนับสนุนสูงสุด</p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-6">
          {donors.length === 0 ? (
            <p className="text-sm text-neutral-400">ยังไม่มีผู้สนับสนุน เป็นคนแรกที่ให้กำลังใจนักเขียนสิ!</p>
          ) : (
            donors.map((d) => (
              <div key={d.user.user_id} className="flex flex-col items-center gap-1">
                <Avatar src={d.user.avatar_url ?? undefined} alt={d.user.username} size="lg" />
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-500">
                  🪙 {d.total_coins}
                </span>
                <span className="text-xs text-neutral-500">{d.user.username}</span>
              </div>
            ))
          )}
        </div>

        {isLoggedIn && (
          <Button variant="primary" size="lg" onClick={() => setOpen(true)}>
            <Gift className="h-4 w-4" />
            ให้ของขวัญ
          </Button>
        )}
      </div>

      {open && (
        <DonateModal
          novelId={novelId}
          authorId={authorId}
          authorUsername={authorUsername}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}
