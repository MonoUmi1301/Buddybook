"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { EditNovelForm } from "@/components/writer/EditNovelForm";
import type { NovelWizardTag } from "@/components/writer/CreateNovelForm";
import type { ManagedNovel, ManagedChapter } from "@/components/writer/novelManagementTypes";

export type { ManagedNovel, ManagedChapter } from "@/components/writer/novelManagementTypes";

interface NovelManagementPanelProps {
  novel: ManagedNovel;
  chapters: ManagedChapter[];
  tags: NovelWizardTag[];
}

const formatLabel: Record<ManagedNovel["format"], string> = {
  multi_chapter: "แบ่งหลายตอน",
  one_shot: "จบในตอนเดียว",
};

const contentRatingLabel: Record<ManagedNovel["content_rating"], string> = {
  all_ages: "ทุกวัย",
  teen: "13+",
  mature: "18+",
};

const visibilityBadge: Record<ManagedNovel["visibility"], { label: string; color: "emerald" | "slate" | "amber" }> = {
  published: { label: "เผยแพร่แล้ว", color: "emerald" },
  private: { label: "ส่วนตัว", color: "slate" },
  pending_review: { label: "รอตรวจสอบ", color: "amber" },
};

const chapterStatusBadge: Record<ManagedChapter["status"], { label: string; color: "emerald" | "slate" | "amber" | "red" }> = {
  draft: { label: "ร่าง", color: "slate" },
  published: { label: "เผยแพร่แล้ว", color: "emerald" },
  scheduled: { label: "รอเผยแพร่", color: "amber" },
  hidden: { label: "ถูกซ่อน", color: "red" },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

/** หน้าจัดการนิยาย — ข้อมูลนิยาย + รายการตอนทุกสถานะ + ลบ (Phase D) */
export function NovelManagementPanel({ novel: initialNovel, chapters: initialChapters, tags }: NovelManagementPanelProps) {
  const router = useRouter();
  const [novel, setNovel] = useState(initialNovel);
  const [chapters, setChapters] = useState(initialChapters);
  const [editing, setEditing] = useState(false);
  const [busyChapterId, setBusyChapterId] = useState<string | null>(null);
  const [pendingDeleteChapter, setPendingDeleteChapter] = useState<ManagedChapter | null>(null);
  const [pendingDeleteNovel, setPendingDeleteNovel] = useState(false);
  const [deletingNovel, setDeletingNovel] = useState(false);
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleVisibility() {
    const next = novel.visibility === "published" ? "private" : "published";
    setChangingVisibility(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/novels/${novel.novel_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
        return;
      }
      setNovel((prev) => ({ ...prev, visibility: next }));
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setChangingVisibility(false);
    }
  }

  async function handleToggleHidden(chapter: ManagedChapter) {
    const nextStatus = chapter.status === "hidden" ? "published" : "hidden";
    setBusyChapterId(chapter.chapter_id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/chapters/${chapter.chapter_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
        return;
      }
      setChapters((prev) =>
        prev.map((c) => (c.chapter_id === chapter.chapter_id ? { ...c, status: nextStatus } : c))
      );
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusyChapterId(null);
    }
  }

  async function handleDeleteChapter() {
    if (!pendingDeleteChapter) return;
    setBusyChapterId(pendingDeleteChapter.chapter_id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/chapters/${pendingDeleteChapter.chapter_id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "ลบตอนไม่สำเร็จ");
        return;
      }
      setChapters((prev) => prev.filter((c) => c.chapter_id !== pendingDeleteChapter.chapter_id));
      setPendingDeleteChapter(null);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusyChapterId(null);
    }
  }

  async function handleDeleteNovel() {
    setDeletingNovel(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/novels/${novel.novel_id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "ลบนิยายไม่สำเร็จ");
        setDeletingNovel(false);
        return;
      }
      router.push("/write");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setDeletingNovel(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {editing ? (
        <EditNovelForm
          novel={novel}
          tags={tags}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setNovel(updated);
            setEditing(false);
          }}
        />
      ) : (
        <div className="flex gap-5 rounded-card border border-neutral-200 p-5">
          <div className="relative h-40 w-28 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
            {novel.cover_image_url ? (
              <Image src={novel.cover_image_url} alt={novel.title} fill sizes="112px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-neutral-300">ไม่มีปก</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-h3 text-neutral-900">{novel.title}</h1>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> แก้ไขข้อมูล
              </Button>
            </div>

            {novel.synopsis && <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{novel.synopsis}</p>}

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Tag color="sky">{formatLabel[novel.format]}</Tag>
              <Tag color="violet">{contentRatingLabel[novel.content_rating]}</Tag>
              {novel.is_translated && <Tag color="amber">งานแปล</Tag>}
              {novel.primary_tag && <Tag color="teal">{novel.primary_tag.name}</Tag>}
              {novel.secondary_tag && <Tag color="teal">{novel.secondary_tag.name}</Tag>}
              {novel.tags.map((t) => (
                <Tag key={t.tag_id} color="slate">
                  {t.name}
                </Tag>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Tag color={visibilityBadge[novel.visibility].color}>{visibilityBadge[novel.visibility].label}</Tag>
              {novel.visibility === "pending_review" ? (
                <span className="text-xs text-neutral-400">เนื้อหากำลังอยู่ระหว่างตรวจสอบ ยังเปลี่ยนสถานะเองไม่ได้ช่วงนี้</span>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  disabled={changingVisibility}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-500 hover:text-primary-600 disabled:opacity-50"
                >
                  {novel.visibility === "published" ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> เก็บเป็นส่วนตัว
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> เผยแพร่นิยายนี้
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 text-neutral-900">ตอนทั้งหมด ({chapters.length})</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/write/${novel.novel_id}/chapters/new`}>
            <Button variant="primary" size="sm">
              <Plus className="h-3.5 w-3.5" /> เขียนตอนใหม่
            </Button>
          </Link>
          <Link href={`/write/${novel.novel_id}/plot`}>
            <Button variant="outline" size="sm">
              <Wand2 className="h-3.5 w-3.5" /> เครื่องมือช่วยแต่งนิยาย
            </Button>
          </Link>
        </div>
      </div>

      {chapters.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">ยังไม่มีตอนในนิยายเรื่องนี้</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 rounded-card border border-neutral-200">
          {chapters
            .slice()
            .sort((a, b) => a.chapter_number - b.chapter_number)
            .map((chapter) => {
              const badge = chapterStatusBadge[chapter.status];
              return (
                <li key={chapter.chapter_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      ตอนที่ {chapter.chapter_number}: {chapter.title}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {chapter.word_count.toLocaleString("th-TH")} ตัวอักษร
                      {chapter.status === "scheduled" && chapter.scheduled_publish_at && (
                        <> · เผยแพร่ {formatDateTime(chapter.scheduled_publish_at)}</>
                      )}
                      {chapter.status === "published" && chapter.published_at && (
                        <> · เผยแพร่เมื่อ {formatDateTime(chapter.published_at)}</>
                      )}
                    </p>
                  </div>
                  <Tag color={badge.color}>{badge.label}</Tag>
                  <Link
                    href={`/write/${novel.novel_id}/chapters/${chapter.chapter_id}`}
                    className="text-xs font-medium text-primary-500 hover:text-primary-600"
                  >
                    แก้ไข
                  </Link>
                  {(chapter.status === "published" || chapter.status === "hidden") && (
                    <button
                      type="button"
                      onClick={() => handleToggleHidden(chapter)}
                      disabled={busyChapterId === chapter.chapter_id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-50"
                      aria-label={chapter.status === "hidden" ? "เผยแพร่อีกครั้ง" : "ซ่อนตอนนี้"}
                    >
                      {chapter.status === "hidden" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingDeleteChapter(chapter)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50"
                    aria-label="ลบตอนนี้"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={`/write/${novel.novel_id}/trash`} className="text-neutral-500 hover:text-neutral-700">
            ถังขยะ
          </Link>
          <Link href={`/write/${novel.novel_id}/print-preview`} className="text-neutral-500 hover:text-neutral-700">
            พรีวิวก่อนพิมพ์
          </Link>
        </div>
        <Button variant="outline" className="!border-red-300 !text-red-600 hover:!bg-red-50" onClick={() => setPendingDeleteNovel(true)}>
          <Trash2 className="h-3.5 w-3.5" /> ลบนิยายนี้
        </Button>
      </div>

      {pendingDeleteChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-card bg-white p-6 text-center shadow-xl">
            <h2 className="text-h3 text-neutral-900">ลบตอนนี้ใช่ไหม?</h2>
            <p className="mt-2 text-sm text-neutral-500">
              &quot;{pendingDeleteChapter.title}&quot; จะถูกย้ายไปถังขยะ กู้คืนได้ภายใน 30 วัน
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => setPendingDeleteChapter(null)}>
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                className="!bg-red-500 hover:!bg-red-600"
                onClick={handleDeleteChapter}
                loading={busyChapterId === pendingDeleteChapter.chapter_id}
              >
                ยืนยันลบ
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteNovel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-card bg-white p-6 text-center shadow-xl">
            <h2 className="text-h3 text-neutral-900">ลบนิยายเรื่องนี้ใช่ไหม?</h2>
            <p className="mt-2 text-sm text-neutral-500">
              &quot;{novel.title}&quot; และทุกตอนในเรื่องจะถูกลบถาวรทันที ไม่สามารถกู้คืนได้
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => setPendingDeleteNovel(false)}>
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                className="!bg-red-500 hover:!bg-red-600"
                onClick={handleDeleteNovel}
                loading={deletingNovel}
              >
                ยืนยันลบถาวร
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
