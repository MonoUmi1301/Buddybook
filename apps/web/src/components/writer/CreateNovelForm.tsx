"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/writer/TagInput";
import { TagPicker } from "@/components/writer/TagPicker";
import { useCloudinaryUpload } from "@/lib/useCloudinaryUpload";
import { formatApiError } from "@/lib/formatApiError";

export interface NovelWizardTag {
  tag_id: number;
  name: string;
  category: "genre" | "mood" | "theme" | "pairing" | "fandom" | null;
  // เพิ่มภายหลัง (Phase L) — null = หมวดหมู่หลัก (top-level), มีค่า = หมวดหมู่รอง ผูกกับหมวดหมู่หลักนั้น
  parent_tag_id?: number | null;
}

type TagValue = { selectedIds: Set<number>; newNames: string[] };
const emptyTagValue: TagValue = { selectedIds: new Set(), newNames: [] };

interface CreateNovelFormProps {
  tags: NovelWizardTag[];
}

const legalStatusOptions: { value: "original" | "fan-fiction"; label: string }[] = [
  { value: "original", label: "งานเขียนต้นฉบับ" },
  { value: "fan-fiction", label: "แฟนฟิค" },
];

const formatOptions: { value: "multi_chapter" | "one_shot"; label: string }[] = [
  { value: "multi_chapter", label: "แบ่งหลายตอน" },
  { value: "one_shot", label: "จบในตอนเดียว" },
];

const contentRatingOptions: { value: "all_ages" | "teen" | "mature"; label: string }[] = [
  { value: "all_ages", label: "ทุกวัย" },
  { value: "teen", label: "13+" },
  { value: "mature", label: "18+" },
];

/** ฟอร์มสร้างนิยายใหม่ — wizard 2 ขั้นตอนตาม spec ที่ผู้ใช้ระบุ (Phase C):
 *  ขั้น 1 = ประเภทงานเขียน/รูปแบบ/งานแปล, ขั้น 2 = ปก/ชื่อ/เรื่องย่อ/หมวดหมู่/แท็ก/เรตติ้ง/ตัวเลือกเปิดปิด */
export function CreateNovelForm({ tags }: CreateNovelFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [legalStatus, setLegalStatus] = useState<(typeof legalStatusOptions)[number]["value"]>("original");
  const [format, setFormat] = useState<(typeof formatOptions)[number]["value"]>("multi_chapter");
  const [isTranslated, setIsTranslated] = useState(false);

  // Step 2
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [primaryTagId, setPrimaryTagId] = useState<number | null>(null);
  const [secondaryTagId, setSecondaryTagId] = useState<number | null>(null);
  const [tagValue, setTagValue] = useState<TagValue>(emptyTagValue);
  const [pairingTagIds, setPairingTagIds] = useState<Set<number>>(new Set());
  const [fandomTagValue, setFandomTagValue] = useState<TagValue>(emptyTagValue);
  const [contentRating, setContentRating] = useState<(typeof contentRatingOptions)[number]["value"]>("all_ages");
  const [allowDonations, setAllowDonations] = useState(true);
  const [allowScreenshots, setAllowScreenshots] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [hideLikeCount, setHideLikeCount] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upload, uploading, error: uploadError } = useCloudinaryUpload("covers");

  // เพิ่มภายหลัง (Phase L) — หมวดหมู่หลัก = genre ที่ไม่มี parent, หมวดหมู่รอง = genre ที่ parent
  // ตรงกับหมวดหมู่หลักที่เลือกไว้เท่านั้น (cascading select)
  const mainGenreTags = tags.filter((t) => t.category === "genre" && !t.parent_tag_id);
  const subGenreTags = tags.filter((t) => t.category === "genre" && t.parent_tag_id === primaryTagId);
  const pairingTags = tags.filter((t) => t.category === "pairing");
  const fandomTags = tags.filter((t) => t.category === "fandom");

  function handlePrimaryTagChange(value: number | null) {
    setPrimaryTagId(value);
    // รีเซ็ตหมวดหมู่รองถ้าอันเดิมไม่ใช่ลูกของหมวดหมู่หลักใหม่แล้ว
    const stillValid = value !== null && tags.some((t) => t.tag_id === secondaryTagId && t.parent_tag_id === value);
    if (!stillValid) setSecondaryTagId(null);
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) setCoverImageUrl(url);
  }

  function goToStep2() {
    setError(null);
    setStep(2);
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
      const res = await fetch("/api/v1/novels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          synopsis: synopsis.trim() || undefined,
          legal_status: legalStatus,
          cover_image_url: coverImageUrl ?? undefined,
          tag_ids: Array.from(tagValue.selectedIds),
          tag_names: tagValue.newNames,
          pairing_tag_ids: Array.from(pairingTagIds),
          pairing_tag_names: [],
          fandom_tag_ids: legalStatus === "fan-fiction" ? Array.from(fandomTagValue.selectedIds) : [],
          fandom_tag_names: legalStatus === "fan-fiction" ? fandomTagValue.newNames : [],
          format,
          is_translated: isTranslated,
          content_rating: contentRating,
          allow_donations: allowDonations,
          allow_screenshots: allowScreenshots,
          allow_comments: allowComments,
          hide_like_count: hideLikeCount,
          primary_tag_id: primaryTagId ?? undefined,
          secondary_tag_id: secondaryTagId ?? undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(formatApiError(json, "สร้างนิยายไม่สำเร็จ"));
        setSubmitting(false);
        return;
      }

      router.push(`/write/${json.novel_id}/choose`);
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  if (step === 1) {
    return (
      <div className="space-y-6">
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">ประเภทงานเขียน</p>
          <div className="flex flex-wrap gap-2">
            {legalStatusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLegalStatus(opt.value)}
                className={
                  legalStatus === opt.value
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
          <p className="mb-1.5 text-sm font-medium text-neutral-700">รูปแบบงานเขียน</p>
          <div className="flex flex-wrap gap-2">
            {formatOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormat(opt.value)}
                className={
                  format === opt.value
                    ? "rounded-pill bg-primary-500 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-pill border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={isTranslated}
            onChange={(e) => setIsTranslated(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-400"
          />
          เป็นงานแปล
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.push("/write")}>
            ยกเลิก
          </Button>
          <Button type="button" variant="primary" onClick={goToStep2}>
            ถัดไป
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <Input
        label="ชื่อเรื่อง"
        placeholder="ตั้งชื่อนิยายของคุณ"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      <Textarea
        label="เรื่องย่อ"
        hint="เล่าเรื่องย่อสั้น ๆ ให้ผู้อ่านอยากรู้ต่อ"
        value={synopsis}
        onChange={(e) => setSynopsis(e.target.value)}
        rows={5}
      />

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

      {legalStatus === "fan-fiction" && (
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
        <Button type="button" variant="outline" onClick={() => setStep(1)}>
          ย้อนกลับ
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          สร้างนิยาย
        </Button>
      </div>
    </form>
  );
}
