"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/writer/TagInput";
import { TagPicker } from "@/components/writer/TagPicker";
import { useCloudinaryUpload } from "@/lib/useCloudinaryUpload";
import type { NovelWizardTag } from "@/components/writer/CreateNovelForm";
import type { ManagedNovel } from "@/components/writer/novelManagementTypes";

interface EditNovelFormProps {
  novel: ManagedNovel;
  tags: NovelWizardTag[];
  onSaved: (novel: ManagedNovel) => void;
  onCancel: () => void;
}

const contentRatingOptions: { value: "all_ages" | "teen" | "mature"; label: string }[] = [
  { value: "all_ages", label: "ทุกวัย" },
  { value: "teen", label: "13+" },
  { value: "mature", label: "18+" },
];

// เพิ่มภายหลัง (audit fix) — status มีอยู่แล้วฝั่ง backend (updateNovelBodySchema/updateNovel
// service รับตรง ๆ อยู่ก่อนแล้ว) แต่ไม่เคยมี UI ให้ตั้งค่าหลังสร้างนิยายเลยสักที่ — ผู้ใช้ขอปุ่ม
// "จบแล้ว" ตามหน้าตั้งค่าเรื่องของเว็บอื่น ใช้ปุ่มเลือก 3 ทางแทน checkbox เดียว เพราะระบบมี hiatus
// (พักการเขียน) อยู่แล้วด้วย ไม่ใช่แค่ ongoing/completed
const statusOptions: { value: "ongoing" | "completed" | "hiatus"; label: string }[] = [
  { value: "ongoing", label: "กำลังเขียน" },
  { value: "completed", label: "จบแล้ว" },
  { value: "hiatus", label: "พักการเขียน" },
];

/** แก้ไขข้อมูลนิยาย — ใช้ชุดฟิลด์เดียวกับขั้น 2 ของ CreateNovelForm แต่ PATCH แทน POST
 *  (Phase D ตามแพลน: "edit entry point reusing the step-2 wizard form in edit mode") */
export function EditNovelForm({ novel, tags, onSaved, onCancel }: EditNovelFormProps) {
  const [title, setTitle] = useState(novel.title);
  const [synopsis, setSynopsis] = useState(novel.synopsis ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(novel.cover_image_url);
  const [primaryTagId, setPrimaryTagId] = useState<number | null>(novel.primary_tag?.tag_id ?? null);
  const [secondaryTagId, setSecondaryTagId] = useState<number | null>(novel.secondary_tag?.tag_id ?? null);
  // เพิ่มภายหลัง (Phase M) — novel.tags เป็นตารางเดียวแบนรวมทุกกลุ่ม (ทั่วไป/ความสัมพันธ์/fandom)
  // ต้องแยกตาม category ตอน pre-fill ให้ตรงกล่องพิมพ์ของแต่ละกลุ่ม
  const [tagValue, setTagValue] = useState<{ selectedIds: Set<number>; newNames: string[] }>({
    selectedIds: new Set(novel.tags.filter((t) => t.category !== "pairing" && t.category !== "fandom").map((t) => t.tag_id)),
    newNames: [],
  });
  const [pairingTagIds, setPairingTagIds] = useState<Set<number>>(
    new Set(novel.tags.filter((t) => t.category === "pairing").map((t) => t.tag_id))
  );
  const [fandomTagValue, setFandomTagValue] = useState<{ selectedIds: Set<number>; newNames: string[] }>({
    selectedIds: new Set(novel.tags.filter((t) => t.category === "fandom").map((t) => t.tag_id)),
    newNames: [],
  });
  const [contentRating, setContentRating] = useState(novel.content_rating);
  const [status, setStatus] = useState(novel.status);
  const [allowDonations, setAllowDonations] = useState(novel.allow_donations);
  const [allowScreenshots, setAllowScreenshots] = useState(novel.allow_screenshots);
  const [allowComments, setAllowComments] = useState(novel.allow_comments);
  const [hideLikeCount, setHideLikeCount] = useState(novel.hide_like_count);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upload, uploading, error: uploadError } = useCloudinaryUpload("covers");

  const mainGenreTags = tags.filter((t) => t.category === "genre" && !t.parent_tag_id);
  const subGenreTags = tags.filter((t) => t.category === "genre" && t.parent_tag_id === primaryTagId);
  const pairingTags = tags.filter((t) => t.category === "pairing");
  const fandomTags = tags.filter((t) => t.category === "fandom");

  function handlePrimaryTagChange(value: number | null) {
    setPrimaryTagId(value);
    const stillValid = value !== null && tags.some((t) => t.tag_id === secondaryTagId && t.parent_tag_id === value);
    if (!stillValid) setSecondaryTagId(null);
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) setCoverImageUrl(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("กรุณากรอกชื่อเรื่อง");
      return;
    }
    if (primaryTagId && secondaryTagId && primaryTagId === secondaryTagId) {
      setError("หมวดหมู่หลักและหมวดหมู่รองต้องไม่ซ้ำกัน");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/novels/${novel.novel_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          synopsis: synopsis.trim() || undefined,
          cover_image_url: coverImageUrl ?? undefined,
          tag_ids: Array.from(tagValue.selectedIds),
          tag_names: tagValue.newNames,
          pairing_tag_ids: Array.from(pairingTagIds),
          pairing_tag_names: [],
          fandom_tag_ids: Array.from(fandomTagValue.selectedIds),
          fandom_tag_names: fandomTagValue.newNames,
          content_rating: contentRating,
          status,
          allow_donations: allowDonations,
          allow_screenshots: allowScreenshots,
          allow_comments: allowComments,
          hide_like_count: hideLikeCount,
          primary_tag_id: primaryTagId,
          secondary_tag_id: secondaryTagId,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "บันทึกไม่สำเร็จ");
        setSubmitting(false);
        return;
      }

      onSaved({
        ...novel,
        title: title.trim(),
        synopsis: synopsis.trim() || null,
        cover_image_url: coverImageUrl,
        content_rating: contentRating,
        status,
        allow_donations: allowDonations,
        allow_screenshots: allowScreenshots,
        allow_comments: allowComments,
        hide_like_count: hideLikeCount,
        primary_tag: mainGenreTags.find((t) => t.tag_id === primaryTagId) ?? null,
        secondary_tag: subGenreTags.find((t) => t.tag_id === secondaryTagId) ?? null,
        // ใช้ tags ที่ backend คืนมาจริง (resolve tag_names ใหม่เสร็จแล้ว มี tag_id จริง) แทนการเดา
        // จาก state ฝั่ง client เอง ซึ่งไม่รู้ tag_id ของแท็กที่เพิ่งพิมพ์สร้างใหม่
        tags: (json.tags as ManagedNovel["tags"]) ?? novel.tags,
      });
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-card border border-neutral-200 p-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">ปกนิยาย</p>
        <label className="group relative flex h-40 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-primary-400">
          {coverImageUrl ? (
            <Image src={coverImageUrl} alt="ปกนิยาย" fill className="object-cover" />
          ) : uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          ) : (
            <Camera className="h-6 w-6 text-neutral-300" />
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} disabled={uploading} />
        </label>
        {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
      </div>

      <Input label="ชื่อเรื่อง" value={title} onChange={(e) => setTitle(e.target.value)} required />

      <Textarea label="เรื่องย่อ" value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={5} />

      {mainGenreTags.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">หมวดหมู่หลัก</label>
            <select
              value={primaryTagId ?? ""}
              onChange={(e) => handlePrimaryTagChange(e.target.value ? Number(e.target.value) : null)}
              className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-400 focus:outline-none"
            >
              <option value="">ไม่ระบุ</option>
              {mainGenreTags.map((t) => (
                <option key={t.tag_id} value={t.tag_id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">หมวดหมู่รอง</label>
            <select
              value={secondaryTagId ?? ""}
              onChange={(e) => setSecondaryTagId(e.target.value ? Number(e.target.value) : null)}
              disabled={!primaryTagId}
              className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              <option value="">{primaryTagId ? "ไม่ระบุ" : "เลือกหมวดหมู่หลักก่อน"}</option>
              {subGenreTags.map((t) => (
                <option key={t.tag_id} value={t.tag_id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">แท็ก</p>
        <TagInput allTags={tags} value={tagValue} onChange={setTagValue} />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">ความสัมพันธ์ในเรื่อง</p>
        <TagPicker allTags={pairingTags} selectedIds={pairingTagIds} onChange={setPairingTagIds} max={5} />
      </div>

      {novel.legal_status === "fan-fiction" && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Fandom / ต้นฉบับ</p>
          <TagInput allTags={fandomTags} value={fandomTagValue} onChange={setFandomTagValue} max={5} />
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">เรตติ้งเนื้อหา</p>
        <div className="flex flex-wrap gap-2">
          {contentRatingOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setContentRating(opt.value)}
              className={
                contentRating === opt.value
                  ? "rounded-pill bg-primary-500 px-4 py-2 text-sm font-medium text-white"
                  : "rounded-pill border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">สถานะเรื่อง</p>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={
                status === opt.value
                  ? "rounded-pill bg-primary-500 px-4 py-2 text-sm font-medium text-white"
                  : "rounded-pill border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={allowDonations}
            onChange={(e) => setAllowDonations(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-400"
          />
          เปิดรับของขวัญ (donation)
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={allowScreenshots}
            onChange={(e) => setAllowScreenshots(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-400"
          />
          อนุญาตให้แคปหน้าจอ
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={allowComments}
            onChange={(e) => setAllowComments(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-400"
          />
          เปิดให้แสดงความคิดเห็น
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={hideLikeCount}
            onChange={(e) => setHideLikeCount(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-400"
          />
          ซ่อนจำนวนหัวใจ
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          บันทึก
        </Button>
      </div>
    </form>
  );
}
