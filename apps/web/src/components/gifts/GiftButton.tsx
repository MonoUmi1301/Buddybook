"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GiftDialog } from "@/components/gifts/GiftDialog";
import { RESUME_PARAM, RESUME_VALUE, readDraft, type GiftDraft, type GiftTarget } from "@/lib/gifts";
import { cn } from "@/lib/cn";

type Variant = "hero" | "sidebar" | "inline" | "profile";

interface GiftButtonProps {
  target: GiftTarget;
  /** null = ยังไม่ล็อกอิน (ปุ่มพาไปหน้าเข้าสู่ระบบแทน) */
  viewer: { user_id: string; name: string } | null;
  variant: Variant;
  label?: string;
  initialGiftSlug?: string;
  /** ปุ่มหลักของหน้า — เป็นตัวเปิด dialog ต่อจากร่างเดิมเมื่อกลับมาจากหน้าเติมคอยน์ (?gift=resume)
   *  ตั้งให้ปุ่มเดียวต่อหน้า ไม่งั้นจะเปิดซ้อนกันหลายอัน */
  resumeHost?: boolean;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  hero: "h-11 border border-gift-bear/60 bg-gift-paper px-4 text-sm font-medium text-gift-ink hover:bg-gift-bear/10",
  sidebar: "h-11 w-full bg-gift-bear text-sm font-semibold text-white hover:bg-gift-bear/90",
  inline: "min-h-[44px] bg-gift-bear px-5 text-sm font-semibold text-white hover:bg-gift-bear/90",
  profile: "h-11 border border-gift-bear/60 bg-gift-paper px-4 text-sm font-medium text-gift-ink hover:bg-gift-bear/10",
};

function matchesTarget(draft: GiftDraft, target: GiftTarget) {
  if (draft.target.authorId !== target.authorId) return false;
  return (draft.target.novelId ?? null) === (target.novelId ?? null) || !target.novelId;
}

/** เพิ่มภายหลัง (Gift donations) — ปุ่ม "ส่งของขวัญ" ที่เปิด GiftDialog (หน้านิยาย, ท้ายตอน, หน้านักเขียน) */
export function GiftButton({ target, viewer, variant, label = "ส่งของขวัญ", initialGiftSlug, resumeHost, className }: GiftButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GiftDraft | null>(null);

  useEffect(() => {
    if (!resumeHost || !viewer) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(RESUME_PARAM) !== RESUME_VALUE) return;

    params.delete(RESUME_PARAM);
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });

    const saved = readDraft();
    if (saved && matchesTarget(saved, target)) {
      setDraft(saved);
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เช็คครั้งเดียวตอนเข้าหน้า
  }, []);

  if (viewer?.user_id === target.authorId) return null;

  const base = cn(
    "inline-flex items-center justify-center gap-2 rounded-pill transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gift-bear focus-visible:ring-offset-2",
    variantClasses[variant],
    className
  );

  if (!viewer) {
    return (
      <Link href="/login" className={base}>
        {variant === "sidebar" ? "เข้าสู่ระบบเพื่อส่งของขวัญ" : label}
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={base} aria-haspopup="dialog">
        {label}
      </button>
      {open && (
        <GiftDialog
          target={target}
          viewerName={viewer.name}
          initialGiftSlug={draft ? undefined : initialGiftSlug}
          draft={draft}
          onClose={() => {
            setOpen(false);
            setDraft(null);
          }}
        />
      )}
    </>
  );
}
