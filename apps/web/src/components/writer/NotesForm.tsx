"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { WriterFormActions } from "@/components/writer/WriterFormActions";

export interface NotesFieldConfig {
  name: string;
  label: string;
  hint?: string;
}

interface NotesFormProps {
  novelId: string;
  endpoint: "plot-notes" | "theme-notes";
  fields: NotesFieldConfig[];
  initialValues: Record<string, string>;
  noteTitle: string;
}

/** ฟอร์มบันทึกข้อความอิสระต่อนิยาย (ใช้ร่วมกันทั้งแท็บ Plot และ Theme) — เดิมทั้งสองแท็บนี้เป็นแค่
 *  UI mock ปุ่ม "บันทึก" ไม่เคยยิง API จริง (setTimeout หลอก) กรอกแล้วสลับแท็บ/ออกจากหน้าข้อมูล
 *  หายหมด แก้ให้ผูกกับ PATCH /novels/:id/plot-notes|theme-notes จริง
 *  ถ้ามีข้อมูลที่เคยบันทึกไว้แล้ว เปิดหน้ามาจะเจอโน้ตอย่างเดียว (ไม่ใช่ช่องกรอกโล่ง ๆ ที่ทำให้
 *  เข้าใจผิดว่าข้อมูลหาย) ต้องกด "แก้ไขข้อมูล" ก่อนถึงจะเห็น/แก้ช่องกรอกอีกที ตามที่ผู้ใช้ขอ */
export function NotesForm({ novelId, endpoint, fields, initialValues, noteTitle }: NotesFormProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [savedValues, setSavedValues] = useState<Record<string, string>>(initialValues);
  const [error, setError] = useState<string | null>(null);

  const savedEntries = fields.filter((f) => savedValues[f.name]?.trim());
  const [mode, setMode] = useState<"view" | "edit">(savedEntries.length > 0 ? "view" : "edit");

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    setError(null);
    try {
      const res = await fetch(`/api/v1/novels/${novelId}/${endpoint}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
        throw new Error("save_failed");
      }
      setSavedValues(values);
      setMode("view");
    } catch (err) {
      if (!(err instanceof Error && err.message === "save_failed")) {
        setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      }
      throw err;
    }
  }

  function handleCancel() {
    setError(null);
    setValues(savedValues);
    if (savedEntries.length > 0) setMode("view");
  }

  const noteCard = (
    <div className="flex justify-center">
      <div className="w-full max-w-lg -rotate-1 rounded-sm bg-amber-50 p-6 shadow-md ring-1 ring-amber-200/70">
        <div className="mx-auto mb-4 h-4 w-20 -rotate-2 rounded-sm bg-amber-200/70" />
        <p className="mb-4 text-center font-serif text-base font-semibold text-amber-800">{noteTitle}</p>
        <div className="space-y-4">
          {savedEntries.map((f) => (
            <div key={f.name} className="border-b border-dashed border-amber-200 pb-3 last:border-0 last:pb-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">{f.label}</p>
              <p className="whitespace-pre-wrap font-serif text-sm italic leading-relaxed text-neutral-800">
                {savedValues[f.name]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (mode === "view") {
    return (
      <div>
        {noteCard}
        <div className="mt-6 flex justify-center">
          <Button type="button" variant="outline" onClick={() => setMode("edit")}>
            <Pencil className="h-4 w-4" />
            แก้ไขข้อมูล
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {fields.map((f) => (
        <div key={f.name} className="mb-5">
          <Textarea
            name={f.name}
            label={f.label}
            hint={f.hint}
            rows={3}
            value={values[f.name] ?? ""}
            onChange={(e) => setField(f.name, e.target.value)}
          />
        </div>
      ))}

      {error && <p className="mb-3 text-center text-sm text-red-500">{error}</p>}
      <WriterFormActions onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
}
