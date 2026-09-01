"use client";

import { useEffect, useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PublishChoiceModal, type PublishChoice } from "@/components/writer/PublishChoiceModal";
import { formatApiError } from "@/lib/formatApiError";

// Quill แตะ DOM ตรง ๆ ตอน construct — โหลดแบบ ssr:false (ทำได้เฉพาะใน Client Component)
// ตาม pattern มาตรฐานของ Next.js App Router
const QuillEditor = dynamicImport(
  () => import("@/components/writer/QuillEditor").then((m) => m.QuillEditor),
  { ssr: false, loading: () => <div className="h-[400px] animate-pulse rounded-lg bg-neutral-100" /> }
);

interface ChapterEditorFormProps {
  novelId: string;
  novelTitle: string;
  chapterNumber: number;
  /** undefined = ยังไม่มีตอนนี้ใน DB จริง (สร้างใหม่) — มีค่าแล้ว = แก้ไขตอนที่มีอยู่ */
  chapterId?: string;
  initialTitle?: string;
  initialContent?: string;
  initialStatus?: "draft" | "published" | "scheduled" | "hidden";
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_INTERVAL_MS = 30_000;

/**
 * หน้าตอนเขียนนิยาย — ชื่อตอน + Quill editor + auto-save ทุก 30 วิ
 * ตาม BuddyBook_Swimlane_UseCases.md UC1: พิมพ์ -> debounce 30 วิ -> PATCH /chapters/:id/autosave
 * -> INSERT chapter_versions(is_autosave=true) ก่อนจะมี chapter_id จริง (ยังไม่ได้กด "บันทึกร่าง"
 * ครั้งแรก) จะยัง autosave ไม่ได้ เพราะยังไม่มีแถวใน DB ให้ผูก — ต้องสร้างก่อนอย่างน้อยหนึ่งครั้ง
 */
export function ChapterEditorForm({
  novelId,
  novelTitle,
  chapterNumber,
  chapterId: initialChapterId,
  initialTitle = "",
  initialContent = "",
  initialStatus = "draft",
}: ChapterEditorFormProps) {
  const router = useRouter();
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [chapterStatus, setChapterStatus] = useState(initialStatus);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const contentRef = useRef(content);
  const titleRef = useRef(title);
  const dirtyRef = useRef(false);
  // audit fix — กัน autosave request ซ้อนกัน (request ช้าจากรอบก่อนยังไม่ตอบ แต่ timer รอบถัดไปยิงซ้ำ
  // ไปแล้ว) ไม่มี sequencing เดิม ทำให้ response อาจแซงกันจนเซฟทับด้วยเนื้อหาเก่ากว่าได้
  const autosaveInFlightRef = useRef(false);
  contentRef.current = content;
  titleRef.current = title;

  async function persist(
    status: "draft" | "published" | "scheduled",
    scheduledPublishAt?: string,
    onError?: (message: string) => void
  ): Promise<boolean> {
    setErrorMessage(null);

    if (!titleRef.current.trim()) {
      const message = "กรุณาตั้งชื่อตอนก่อนบันทึก";
      (onError ?? setErrorMessage)(message);
      return false;
    }

    try {
      if (!chapterId) {
        const res = await fetch(`/api/v1/novels/${novelId}/chapters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapter_number: chapterNumber,
            title: titleRef.current.trim(),
            content: contentRef.current,
            status,
            scheduled_publish_at: scheduledPublishAt,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          (onError ?? setErrorMessage)(formatApiError(json, "บันทึกตอนไม่สำเร็จ"));
          return false;
        }
        setChapterId(json.chapter_id);
        setChapterStatus(status);
        router.replace(`/write/${novelId}/chapters/${json.chapter_id}`);
        return true;
      }

      const res = await fetch(`/api/v1/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleRef.current.trim(),
          content: contentRef.current,
          status,
          scheduled_publish_at: scheduledPublishAt,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        (onError ?? setErrorMessage)(formatApiError(json, "บันทึกตอนไม่สำเร็จ"));
        return false;
      }
      setChapterStatus(status);
      return true;
    } catch {
      (onError ?? setErrorMessage)("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      return false;
    }
  }

  async function handleSaveDraft() {
    setSaveStatus("saving");
    const ok = await persist("draft");
    setSaveStatus(ok ? "saved" : "error");
  }

  async function handlePublishConfirm(choice: PublishChoice, scheduledPublishAt?: string) {
    setPublishing(true);
    setPublishError(null);
    const ok = await persist(choice, scheduledPublishAt, setPublishError);
    setPublishing(false);
    if (ok) router.push("/write");
  }

  // Auto-save ทุก 30 วินาที — เฉพาะตอนที่มี chapter_id จริงแล้ว (สร้างครั้งแรกผ่าน "บันทึกร่าง")
  useEffect(() => {
    const timer = setInterval(async () => {
      // audit fix — ถ้า request รอบก่อนยังไม่ตอบกลับ ข้ามรอบนี้ไปก่อน (ไม่ยิงซ้อน) dirtyRef ยังเป็น
      // true อยู่ต่อ รอบถัดไปจะลองใหม่พร้อมเนื้อหาล่าสุดเสมอ ไม่มีอะไรหาย
      if (!chapterId || !dirtyRef.current || autosaveInFlightRef.current) return;
      dirtyRef.current = false;
      autosaveInFlightRef.current = true;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/v1/chapters/${chapterId}/autosave`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_snapshot: contentRef.current,
            // audit fix — เดิมส่งแค่เนื้อหา ทำให้แก้ชื่อตอนแล้ว autosave ไม่บันทึกชื่อจริง (ค้าง
            // ชื่อเดิมจนกว่าจะกด "บันทึกร่าง"/"จบงาน") ส่งเฉพาะตอนที่มีชื่อจริงเท่านั้น กันชื่อว่าง
            // ไปเขียนทับของเดิมโดยไม่ตั้งใจ
            ...(titleRef.current.trim() ? { title: titleRef.current.trim() } : {}),
          }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      } finally {
        autosaveInFlightRef.current = false;
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [chapterId]);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500">
          <Link href="/write" className="hover:text-primary-500">
            กลับสู่หน้าหลัก
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={`/write/${novelId}`} className="hover:text-primary-500">
            {novelTitle}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-primary-500">
            ตอนที่ {chapterNumber}
            {chapterStatus === "published" && " (เผยแพร่แล้ว)"}
            {chapterStatus === "scheduled" && " (รอเผยแพร่)"}
            {chapterStatus === "hidden" && " (ถูกซ่อน)"}
            {chapterStatus === "draft" && " (ร่าง)"}
          </span>
        </nav>

        <div className="mb-6">
          <Input
            label="ชื่อตอน"
            placeholder="ตั้งชื่อตอนอย่างสุภาพ"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              dirtyRef.current = true;
            }}
          />
        </div>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-800">เนื้อหา</p>
          <span className="flex items-center gap-1.5 text-xs text-neutral-400">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังบันทึกอัตโนมัติ...
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" /> บันทึกแล้ว
              </>
            )}
            {saveStatus === "error" && <span className="text-red-500">บันทึกอัตโนมัติไม่สำเร็จ</span>}
          </span>
        </div>

        <div className="rounded-lg border border-neutral-200">
          <QuillEditor
            defaultValue={initialContent}
            placeholder="เริ่มเขียนเรื่องราวของคุณที่นี่..."
            onChange={(html) => {
              setContent(html);
              dirtyRef.current = true;
              setSaveStatus("idle");
            }}
          />
        </div>

        {errorMessage && <p className="mt-3 text-sm text-red-500">{errorMessage}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={handleSaveDraft} loading={saveStatus === "saving"}>
            บันทึกร่าง
          </Button>
          <Button variant="primary" onClick={() => setShowPublishModal(true)} loading={publishing}>
            จบงาน
          </Button>
        </div>
      </div>

      {showPublishModal && (
        <PublishChoiceModal
          onClose={() => {
            setShowPublishModal(false);
            setPublishError(null);
          }}
          onConfirm={(choice, scheduledPublishAt) => {
            handlePublishConfirm(choice, scheduledPublishAt);
          }}
          submitting={publishing}
          errorMessage={publishError}
        />
      )}
    </div>
  );
}
