"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ModalBackdrop } from "@/components/ui/modal-backdrop";

export interface ResumeFrom {
  chapter_id: string;
  chapter_number: number;
  title: string;
}

/** กดตอนก่อนหน้า/ถัดไปในหน้าอ่าน = ผู้ใช้ตั้งใจเปลี่ยนตอนเอง ไม่ต้องถามว่าจะกลับไปอ่านต่อไหม */
const READER_NAV_KEY = "bb:reader-nav";

export function markReaderNavigation(chapterId: string) {
  try {
    sessionStorage.setItem(READER_NAV_KEY, chapterId);
  } catch {
    // sessionStorage ใช้ไม่ได้ (private mode ฯลฯ) — แค่จะเห็นป๊อปอัปถามเพิ่มอีกครั้ง
  }
}

function consumeReaderNavigation(chapterId: string): boolean {
  try {
    const marked = sessionStorage.getItem(READER_NAV_KEY) === chapterId;
    sessionStorage.removeItem(READER_NAV_KEY);
    return marked;
  } catch {
    return false;
  }
}

/** เปิดตอนอื่นที่ไม่ใช่ตอนที่อ่านค้างไว้ → ถามว่าจะกลับไปอ่านตอนที่ค้างไว้ไหม
 *  (API ส่ง resume_from มาเฉพาะเมื่อควรถาม — ไม่นับการอ่านตอนถัดไปตามลำดับ) */
export function ResumeReadingPrompt({
  novelId,
  chapterId,
  resumeFrom,
}: {
  novelId: string;
  chapterId: string;
  resumeFrom: ResumeFrom;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // StrictMode รัน effect ซ้ำ — รอบสองจะไม่เจอ marker ที่รอบแรกลบไปแล้วและเปิดป๊อปอัปผิด ๆ จึงเช็คครั้งเดียว
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    if (!consumeReaderNavigation(chapterId)) setOpen(true);
  }, [chapterId]);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <ModalBackdrop className="z-[60] items-center bg-black/40 px-4" onDismiss={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-title"
        className="relative w-full max-w-sm rounded-card bg-white p-6 text-center shadow-xl"
      >
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/15 text-primary-600">
          <BookmarkCheck className="h-6 w-6" />
        </span>
        <h2 id="resume-title" className="text-lg font-semibold text-neutral-900">
          คุณอ่านตอนที่ {resumeFrom.chapter_number} ค้างไว้
        </h2>
        <p className="mt-1.5 text-sm text-neutral-500">
          “{resumeFrom.title}” — จะกลับไปอ่านต่อจากตอนนั้นหรือไม่?
        </p>
        <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row sm:gap-3">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            อ่านตอนนี้แทน
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            onClick={() => {
              setOpen(false);
              markReaderNavigation(resumeFrom.chapter_id);
              router.push(`/novels/${novelId}/chapters/${resumeFrom.chapter_id}`);
            }}
          >
            กลับไปอ่านตอนที่ {resumeFrom.chapter_number}
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
