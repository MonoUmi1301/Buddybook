"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Check, CloudOff, HardDrive } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PublishChoiceModal, type PublishChoice } from "@/components/writer/PublishChoiceModal";
import { formatApiError } from "@/lib/formatApiError";
import { countCharacters, estimatePageCount } from "@/lib/textStats";
import { type LocalDraft, chapterDraftKey, clearDraft, readDraft, writeDraft } from "@/lib/draftStore";

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
  /** เพิ่มภายหลัง (ตอนติดเหรียญ) — 0 = อ่านฟรี */
  initialPriceCoins?: number;
  /** gap 2.5 — updated_at ของตอนบนเซิร์ฟเวอร์ตอนเปิดหน้า (ใช้ตรวจการแก้ไขชนกันข้ามแท็บ) */
  initialUpdatedAt?: string | null;
}

const MAX_CHAPTER_PRICE = 1000;

type SaveStatus = "idle" | "local" | "saving" | "saved" | "offline" | "conflict" | "error";

const AUTOSAVE_INTERVAL_MS = 30_000;
/** เขียนร่างลงเครื่องหลังหยุดพิมพ์เท่านี้ (ms) — ถี่กว่า auto-save เซิร์ฟเวอร์มาก แต่ไม่ถึงกับทุกตัวอักษร */
const LOCAL_DRAFT_DEBOUNCE_MS = 800;
/** fetch keepalive ส่ง body ได้ไม่เกิน ~64KB — ใหญ่กว่านี้พึ่งร่างในเครื่องอย่างเดียวตอนปิดแท็บ */
const KEEPALIVE_MAX_BODY = 60_000;

/**
 * หน้าตอนเขียนนิยาย — ชื่อตอน + Quill editor + auto-save ทุก 30 วิ
 * ตาม BuddyBook_Swimlane_UseCases.md UC1: พิมพ์ -> debounce 30 วิ -> PATCH /chapters/:id/autosave
 * -> INSERT chapter_versions(is_autosave=true) ก่อนจะมี chapter_id จริง (ยังไม่ได้กด "บันทึกร่าง"
 * ครั้งแรก) จะยัง autosave ไม่ได้ เพราะยังไม่มีแถวใน DB ให้ผูก — ต้องสร้างก่อนอย่างน้อยหนึ่งครั้ง
 *
 * gap 2.5 (KPI-3: ไม่มีงานหายแม้เน็ตหลุด/ปิดเบราว์เซอร์ทันที):
 *   - ทุกการพิมพ์เขียนร่างลง localStorage (debounce 0.8 วิ) รวมถึงตอนที่ยังไม่เคยบันทึก
 *   - แท็บถูกซ่อน/ปิด (visibilitychange/pagehide) → เขียนร่างทันที + ยิง autosave แบบ keepalive
 *   - ออฟไลน์ → แสดงสถานะ "บันทึกไว้ในเครื่อง" แล้วซิงก์ทันทีเมื่อกลับมาออนไลน์
 *   - เปิดหน้าใหม่แล้วพบร่างในเครื่องที่ต่างจากเซิร์ฟเวอร์ → ถามว่าจะกู้คืนหรือไม่
 *   - ส่ง base_updated_at ไปกับ autosave — ถูกแก้จากแท็บอื่นแล้วได้ 409 ให้ผู้ใช้เลือก ไม่ทับเงียบ ๆ
 */
export function ChapterEditorForm({
  novelId,
  novelTitle,
  chapterNumber,
  chapterId: initialChapterId,
  initialTitle = "",
  initialContent = "",
  initialStatus = "draft",
  initialPriceCoins = 0,
  initialUpdatedAt = null,
}: ChapterEditorFormProps) {
  const router = useRouter();
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [chapterStatus, setChapterStatus] = useState(initialStatus);
  const [isPaid, setIsPaid] = useState(initialPriceCoins > 0);
  const [priceCoins, setPriceCoins] = useState(initialPriceCoins > 0 ? initialPriceCoins : 10);
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
  const baseUpdatedAtRef = useRef<string | null>(initialUpdatedAt);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recoverableDraft, setRecoverableDraft] = useState<LocalDraft | null>(null);
  // Quill รับแค่ defaultValue ตอน mount — เปลี่ยน key เพื่อ remount พร้อมเนื้อหาที่กู้คืน
  const [editorSeed, setEditorSeed] = useState({ key: 0, value: initialContent });
  contentRef.current = content;
  titleRef.current = title;
  const draftKeyRef = useRef(chapterDraftKey(novelId, chapterId, chapterNumber));
  draftKeyRef.current = chapterDraftKey(novelId, chapterId, chapterNumber);

  const saveLocalDraftNow = useCallback(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    if (!dirtyRef.current) return;
    writeDraft(draftKeyRef.current, {
      title: titleRef.current,
      content: contentRef.current,
      saved_at: Date.now(),
      base_updated_at: baseUpdatedAtRef.current,
    });
  }, []);

  function scheduleLocalDraft() {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      saveLocalDraftNow();
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setSaveStatus((s) => (s === "conflict" ? s : offline ? "offline" : s === "idle" ? "local" : s));
    }, LOCAL_DRAFT_DEBOUNCE_MS);
  }

  /** เซิร์ฟเวอร์ได้รับแล้ว — ลบร่างในเครื่องเฉพาะเมื่อไม่มีการพิมพ์เพิ่มระหว่างรอ response */
  function markSynced(sent: { title: string; content: string }, serverUpdatedAt?: string | null) {
    if (serverUpdatedAt) baseUpdatedAtRef.current = serverUpdatedAt;
    if (contentRef.current === sent.content && titleRef.current === sent.title) {
      clearDraft(draftKeyRef.current);
    } else {
      saveLocalDraftNow();
    }
  }

  // เปิดหน้าแล้วพบร่างในเครื่องที่ยังไม่ถึงเซิร์ฟเวอร์ → เสนอให้กู้คืน
  useEffect(() => {
    const draft = readDraft(draftKeyRef.current);
    if (!draft) return;
    if (draft.content === initialContent && draft.title === initialTitle) {
      clearDraft(draftKeyRef.current);
      return;
    }
    setRecoverableDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตรวจครั้งเดียวตอนเปิดหน้า
  }, []);

  function restoreLocalDraft() {
    if (!recoverableDraft) return;
    setTitle(recoverableDraft.title);
    setContent(recoverableDraft.content);
    titleRef.current = recoverableDraft.title;
    contentRef.current = recoverableDraft.content;
    setEditorSeed((prev) => ({ key: prev.key + 1, value: recoverableDraft.content }));
    dirtyRef.current = true;
    setRecoverableDraft(null);
    setSaveStatus("local");
  }

  function discardLocalDraft() {
    clearDraft(draftKeyRef.current);
    setRecoverableDraft(null);
  }

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

    const price_coins = isPaid ? priceCoins : 0;
    if (isPaid && (!Number.isInteger(priceCoins) || priceCoins < 1 || priceCoins > MAX_CHAPTER_PRICE)) {
      (onError ?? setErrorMessage)(`ราคาตอนต้องอยู่ระหว่าง 1-${MAX_CHAPTER_PRICE} คอยน์`);
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
            price_coins,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          (onError ?? setErrorMessage)(formatApiError(json, "บันทึกตอนไม่สำเร็จ"));
          return false;
        }
        // ร่างในเครื่องของ "ตอนใหม่" ย้ายไปผูกกับ chapter_id จริงแล้ว — ลบ key ชั่วคราวทิ้ง
        clearDraft(chapterDraftKey(novelId, undefined, chapterNumber));
        baseUpdatedAtRef.current = json.updated_at ?? null;
        dirtyRef.current = false;
        setChapterId(json.chapter_id);
        setChapterStatus(status);
        router.replace(`/write/${novelId}/chapters/${json.chapter_id}`);
        return true;
      }

      const sent = { title: titleRef.current, content: contentRef.current };
      const res = await fetch(`/api/v1/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleRef.current.trim(),
          content: contentRef.current,
          status,
          scheduled_publish_at: scheduledPublishAt,
          price_coins,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        (onError ?? setErrorMessage)(formatApiError(json, "บันทึกตอนไม่สำเร็จ"));
        return false;
      }
      dirtyRef.current = false;
      markSynced(sent, json.updated_at);
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

  /** ส่งเนื้อหาล่าสุดขึ้นเซิร์ฟเวอร์ (ถ้ามีอะไรค้าง) — ใช้ร่วมกันโดย timer 30 วิ, กลับมาออนไลน์ และตอนปิดแท็บ */
  const flushAutosave = useCallback(
    async (opts: { keepalive?: boolean } = {}) => {
      // audit fix — ถ้า request รอบก่อนยังไม่ตอบกลับ ข้ามรอบนี้ไปก่อน (ไม่ยิงซ้อน)
      if (!chapterId || !dirtyRef.current || autosaveInFlightRef.current) return;
      const sent = { title: titleRef.current, content: contentRef.current };
      if (!sent.content) return;
      const body = JSON.stringify({
        content_snapshot: sent.content,
        // audit fix — ส่งชื่อเฉพาะตอนที่มีชื่อจริง กันชื่อว่างไปเขียนทับของเดิม
        ...(sent.title.trim() ? { title: sent.title.trim() } : {}),
        ...(baseUpdatedAtRef.current ? { base_updated_at: baseUpdatedAtRef.current } : {}),
      });
      if (opts.keepalive && body.length > KEEPALIVE_MAX_BODY) return; // ร่างในเครื่องรับช่วงแทน

      dirtyRef.current = false;
      autosaveInFlightRef.current = true;
      if (!opts.keepalive) setSaveStatus("saving");
      try {
        const res = await fetch(`/api/v1/chapters/${chapterId}/autosave`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: opts.keepalive,
        });
        if (res.ok) {
          const json = (await res.json().catch(() => ({}))) as { chapter_updated_at?: string };
          markSynced(sent, json.chapter_updated_at);
          setSaveStatus(dirtyRef.current ? "local" : "saved");
          return;
        }
        // ไม่สำเร็จ — คืนสถานะ dirty (เดิมหายเงียบจนกว่าจะพิมพ์ใหม่) ร่างในเครื่องยังอยู่ครบ
        dirtyRef.current = true;
        saveLocalDraftNow();
        setSaveStatus(res.status === 409 ? "conflict" : "error");
      } catch {
        dirtyRef.current = true;
        saveLocalDraftNow();
        setSaveStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
      } finally {
        autosaveInFlightRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markSynced อ่านค่าผ่าน ref ทั้งหมด
    [chapterId, saveLocalDraftNow]
  );

  // Auto-save ทุก 30 วินาที — เฉพาะตอนที่มี chapter_id จริงแล้ว (สร้างครั้งแรกผ่าน "บันทึกร่าง")
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (dirtyRef.current) setSaveStatus("offline");
        return;
      }
      void flushAutosave();
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [flushAutosave]);

  // เน็ตหลุด/กลับมา + แท็บถูกซ่อน/ปิด
  useEffect(() => {
    const onOffline = () => {
      saveLocalDraftNow();
      if (dirtyRef.current) setSaveStatus("offline");
    };
    const onOnline = () => void flushAutosave();
    const onHide = () => {
      saveLocalDraftNow();
      void flushAutosave({ keepalive: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      saveLocalDraftNow();
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushAutosave, saveLocalDraftNow]);

  /** 409 — ผู้ใช้ยืนยันใช้ฉบับในแท็บนี้ทับของบนเซิร์ฟเวอร์ */
  async function overwriteServerCopy() {
    baseUpdatedAtRef.current = null;
    dirtyRef.current = true;
    await flushAutosave();
  }

  const charCount = countCharacters(content);
  const pageCount = estimatePageCount(charCount);

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
              titleRef.current = e.target.value;
              dirtyRef.current = true;
              scheduleLocalDraft();
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
            {saveStatus === "local" && (
              <>
                <HardDrive className="h-3.5 w-3.5" /> บันทึกไว้ในเครื่องแล้ว รอซิงก์
              </>
            )}
            {saveStatus === "offline" && (
              <span className="flex items-center gap-1.5 text-amber-600">
                <CloudOff className="h-3.5 w-3.5" /> ออฟไลน์ — บันทึกไว้ในเครื่องแล้ว จะซิงก์เมื่อกลับมาออนไลน์
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-red-500">บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ (สำรองไว้ในเครื่องแล้ว จะลองใหม่)</span>
            )}
          </span>
        </div>

        {saveStatus === "conflict" && (
          <div role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">ตอนนี้ถูกแก้ไขจากแท็บหรืออุปกรณ์อื่นหลังจากที่คุณเปิดไว้</p>
            <p className="mt-0.5 text-xs">งานของคุณในแท็บนี้สำรองไว้ในเครื่องแล้ว เลือกว่าจะทำอย่างไร:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={overwriteServerCopy}>
                ใช้ฉบับในแท็บนี้ทับ
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                โหลดฉบับล่าสุด (กู้ฉบับนี้คืนได้ภายหลัง)
              </Button>
            </div>
          </div>
        )}

        {recoverableDraft && (
          <div role="alert" className="mb-3 rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
            <p className="font-medium">พบงานที่ยังไม่ได้บันทึกขึ้นเซิร์ฟเวอร์ในเครื่องนี้</p>
            <p className="mt-0.5 text-xs">
              บันทึกไว้เมื่อ {new Date(recoverableDraft.saved_at).toLocaleString("th-TH")} (
              {countCharacters(recoverableDraft.content).toLocaleString("th-TH")} ตัวอักษร)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={restoreLocalDraft}>
                กู้คืนฉบับในเครื่อง
              </Button>
              <Button size="sm" variant="outline" onClick={discardLocalDraft}>
                ทิ้ง ใช้ฉบับบนเซิร์ฟเวอร์
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-neutral-200">
          <QuillEditor
            key={editorSeed.key}
            defaultValue={editorSeed.value}
            placeholder="เริ่มเขียนเรื่องราวของคุณที่นี่..."
            onChange={(html) => {
              setContent(html);
              contentRef.current = html;
              dirtyRef.current = true;
              setSaveStatus((s) => (s === "offline" || s === "conflict" ? s : "idle"));
              scheduleLocalDraft();
            }}
          />
        </div>

        {/* เพิ่มภายหลัง (audit fix) — นับตัวอักษร/หน้าโดยประมาณสด ๆ ตอนพิมพ์ ตามที่ผู้ใช้ขอ (มุมซ้าย
            ล่างของกล่องเขียน) คำนวณฝั่ง client ทันทีจาก content ที่มีอยู่แล้ว ไม่ต้องยิง API เพิ่ม */}
        <p className="mt-1.5 text-left text-xs text-neutral-400">
          {charCount.toLocaleString("th-TH")} ตัวอักษร (≈{pageCount} หน้า)
        </p>

        {/* เพิ่มภายหลัง (ตอนติดเหรียญ) — ผู้อ่านต้องจ่ายคอยน์ปลดล็อกก่อนอ่าน รายได้เข้ากระเป๋านักเขียน */}
        <div className="mt-6 rounded-lg border border-neutral-200 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
            <input
              type="checkbox"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary-500"
            />
            ตอนติดเหรียญ (ผู้อ่านต้องปลดล็อกด้วยคอยน์)
          </label>
          {isPaid && (
            <div className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
              <span>ราคา</span>
              <input
                type="number"
                min={1}
                max={MAX_CHAPTER_PRICE}
                step={1}
                value={priceCoins}
                onChange={(e) => setPriceCoins(Math.trunc(Number(e.target.value)))}
                className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-neutral-800"
                aria-label="ราคาตอน (คอยน์)"
              />
              <span>คอยน์</span>
            </div>
          )}
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
