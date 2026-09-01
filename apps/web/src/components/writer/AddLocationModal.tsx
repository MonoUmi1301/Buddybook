"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { LOCATION_ICONS, type LocationIconKey } from "@/components/writer/LocationNode";

interface AddLocationModalProps {
  onClose: () => void;
  onSubmit: (input: { name: string; icon: LocationIconKey; category?: string }) => Promise<void>;
}

const ICON_OPTIONS = Object.keys(LOCATION_ICONS) as LocationIconKey[];
const ICON_LABELS: Record<LocationIconKey, string> = {
  castle: "ปราสาท",
  village: "หมู่บ้าน",
  forest: "ป่า",
  dungeon: "คุกใต้ดิน",
  lake: "ทะเลสาบ",
  volcano: "ภูเขาไฟ",
  market: "ตลาด",
  shrine: "วิหาร",
};

const CATEGORY_OPTIONS = ["ที่พักอาศัย", "ธรรมชาติ", "อันตราย", "ศักดิ์สิทธิ์"];

/** ป๊อปอัพเพิ่มสถานที่ — เดิม QuickAddPopover มีแค่ช่องกรอกชื่อ ไม่มีให้เลือกไอคอน/หมวดหมู่เลย
 *  ทำให้ทุกสถานที่หน้าตาเหมือนกันหมด พอร์ตไอเดียไอคอนสำเร็จรูปมาจาก buddybook_demo/tool_map */
export function AddLocationModal({ onClose, onSubmit }: AddLocationModalProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<LocationIconKey>("castle");
  const [category, setCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("กรุณากรอกชื่อสถานที่");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: trimmed, icon, category: category ?? undefined });
      onClose();
    } catch {
      setError("เพิ่มสถานที่ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">เพิ่มสถานที่</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-1.5 text-xs font-medium text-neutral-500">ไอคอน</p>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {ICON_OPTIONS.map((key) => {
            const IconComponent = LOCATION_ICONS[key];
            const selected = icon === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                title={ICON_LABELS[key]}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors",
                  selected ? "border-primary-500 bg-primary-50" : "border-neutral-200 hover:border-neutral-300"
                )}
              >
                <IconComponent className={cn("h-6 w-6", selected ? "text-primary-500" : "text-neutral-500")} />
                <span className="text-[10px] text-neutral-500">{ICON_LABELS[key]}</span>
              </button>
            );
          })}
        </div>

        <Input
          label="ชื่อสถานที่"
          placeholder="เช่น ปราสาทสีขาว"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <p className="mb-1.5 mt-3 text-xs font-medium text-neutral-500">หมวดหมู่ (ถ้ามี)</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? null : c)}
              className={cn(
                "rounded-pill border px-3 py-1 text-xs font-medium transition-colors",
                category === c ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} loading={submitting}>
            เพิ่มสถานที่
          </Button>
        </div>
      </div>
    </div>
  );
}
