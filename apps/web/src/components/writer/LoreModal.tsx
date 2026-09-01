"use client";

import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ChapterOption {
  chapter_id: string;
  chapter_number: number;
  title: string;
}

interface LoreModalProps {
  novelId: string;
  locationName: string;
  initialLore: string;
  initialChapterId: string | null;
  chapters: ChapterOption[];
  onClose: () => void;
  onSave: (input: { lore: string; chapterId: string | null }) => Promise<void>;
}

/** แผงหมุดผูกฐานข้อมูล (Lore Link Marker) — คลิกไอคอนหนังสือบน NodeToolbar ของสถานที่เพื่อเปิด
 *  แสดง/แก้ไขเนื้อหาเรื่องราวของสถานที่นั้น (ใช้ Location.description เดิมเป็นเนื้อหา lore)
 *  พร้อมผูกลิงก์ไปยังตอนที่เกี่ยวข้องในนิยาย (Location.linked_chapter_id ของใหม่) */
export function LoreModal({ novelId, locationName, initialLore, initialChapterId, chapters, onClose, onSave }: LoreModalProps) {
  const [lore, setLore] = useState(initialLore);
  const [chapterId, setChapterId] = useState<string | null>(initialChapterId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ lore, chapterId });
      onClose();
    } catch {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">เนื้อหาเรื่องราว: {locationName}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-medium text-neutral-500">เนื้อหา / ประวัติของสถานที่นี้</label>
        <textarea
          value={lore}
          onChange={(e) => setLore(e.target.value)}
          rows={5}
          placeholder="เช่น ปราสาทแห่งนี้เคยเป็นที่ประทับของกษัตริย์องค์แรก..."
          className="w-full resize-none rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />

        <label className="mb-1.5 mt-3 block text-xs font-medium text-neutral-500">ผูกกับตอน (ถ้ามี)</label>
        <select
          value={chapterId ?? ""}
          onChange={(e) => setChapterId(e.target.value || null)}
          className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-400 focus:outline-none"
        >
          <option value="">ไม่ผูกกับตอนไหน</option>
          {chapters.map((c) => (
            <option key={c.chapter_id} value={c.chapter_id}>
              ตอนที่ {c.chapter_number}: {c.title}
            </option>
          ))}
        </select>

        {chapterId && (
          <a
            href={`/novels/${novelId}/chapters/${chapterId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:underline"
          >
            เปิดตอนที่ผูกไว้ <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} loading={saving}>
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}
