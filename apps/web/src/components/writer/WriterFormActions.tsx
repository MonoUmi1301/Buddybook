"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface WriterFormActionsProps {
  onSave?: () => void | Promise<void>;
  onCancel?: () => void;
}

/** ปุ่ม ยกเลิก/บันทึก ท้ายฟอร์มทุกแท็บของ World-building tool ดู wf_settings_forms.png
 *  onSave รองรับ Promise — รอผลจริงก่อนขึ้น "บันทึกแล้ว" (เดิม setTimeout หลอกไม่สนผลจริงของ onSave) */
export function WriterFormActions({ onSave, onCancel }: WriterFormActionsProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await onSave?.();
      setSaved(true);
    } catch {
      // ผู้เรียกโชว์ข้อความ error เองแล้ว (ดู NotesForm) — แค่ไม่ขึ้น "บันทึกแล้ว" ก็พอ
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      <Button type="button" variant="outline" onClick={onCancel}>
        ยกเลิก
      </Button>
      <Button type="button" variant="primary" loading={saving} onClick={handleSave}>
        {saved ? "บันทึกแล้ว ✓" : "บันทึก"}
      </Button>
    </div>
  );
}
