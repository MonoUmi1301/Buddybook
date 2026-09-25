"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { clearDraft, readDraft, resumeHref, type GiftDraft } from "@/lib/gifts";

/** เพิ่มภายหลัง (Gift donations) — แถบบนหน้าเติมคอยน์ เมื่อผู้ใช้ออกมาจาก GiftDialog เพราะคอยน์ไม่พอ
 *  พากลับไปหน้าเดิม (?gift=resume) ให้ GiftButton เปิด dialog พร้อมร่างเดิม */
export function GiftDraftBanner() {
  const [draft, setDraft] = useState<GiftDraft | null>(null);

  useEffect(() => {
    setDraft(readDraft());
  }, []);

  if (!draft) return null;

  return (
    <div className="border-b border-gift-edge bg-gift-paper">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <p className="min-w-0 flex-1 text-sm text-gift-ink">
          ของขวัญถึง <span className="font-semibold">{draft.target.authorName}</span> ยังไม่ได้ส่ง เติมคอยน์เสร็จแล้วกลับไปส่งต่อได้เลย
        </p>
        <Link
          href={resumeHref(draft.returnTo)}
          className="inline-flex min-h-[44px] items-center rounded-pill bg-gift-bear px-5 text-sm font-semibold text-white hover:bg-gift-bear/90"
        >
          กลับไปส่งของขวัญ
        </Link>
        <button
          type="button"
          onClick={() => {
            clearDraft();
            setDraft(null);
          }}
          aria-label="ยกเลิกของขวัญที่ค้างไว้"
          className="flex h-11 w-11 items-center justify-center rounded-full text-gift-muted hover:bg-gift-edge/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
