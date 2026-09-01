"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type PublishChoice = "published" | "scheduled" | "draft";

interface PublishChoiceModalProps {
  onClose: () => void;
  onConfirm: (choice: PublishChoice, scheduledPublishAt?: string) => void;
  submitting: boolean;
  errorMessage?: string | null;
}

const choiceOptions: { value: PublishChoice; label: string; hint: string }[] = [
  { value: "published", label: "เผยแพร่ทันที", hint: "ผู้อ่านจะเห็นตอนนี้ได้ทันทีหลังกดยืนยัน" },
  { value: "scheduled", label: "ตั้งเวลาเผยแพร่", hint: "ระบบจะเผยแพร่ให้อัตโนมัติเมื่อถึงเวลาที่กำหนด" },
  { value: "draft", label: "เก็บไว้ก่อน", hint: "บันทึกเป็นร่าง ยังไม่เผยแพร่ให้ใครเห็น" },
];

/** ป๊อปอัพเลือกวิธี "จบงาน" ตอนกดปุ่มเผยแพร่ในตัวแก้ไขตอน (Phase E) — แทนที่การเผยแพร่ทันที
 *  แบบเดิมที่ไม่มีทางเลือก ใช้ดีไซน์ modal เดียวกับ DonateModal.tsx */
export function PublishChoiceModal({ onClose, onConfirm, submitting, errorMessage }: PublishChoiceModalProps) {
  const [choice, setChoice] = useState<PublishChoice>("published");
  const [scheduledAt, setScheduledAt] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleConfirm() {
    setValidationError(null);
    if (choice === "scheduled") {
      if (!scheduledAt) {
        setValidationError("กรุณาเลือกวันเวลาที่ต้องการเผยแพร่");
        return;
      }
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        setValidationError("เวลาที่ตั้งต้องอยู่ในอนาคต");
        return;
      }
      onConfirm(choice, new Date(scheduledAt).toISOString());
      return;
    }
    onConfirm(choice);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">จบงานตอนนี้ยังไง?</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {choiceOptions.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 transition-colors",
                choice === opt.value ? "border-primary-400 bg-primary-50" : "border-neutral-200 hover:bg-neutral-50"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                <input
                  type="radio"
                  name="publish-choice"
                  checked={choice === opt.value}
                  onChange={() => setChoice(opt.value)}
                  className="h-4 w-4 text-primary-500 focus:ring-primary-400"
                />
                {opt.label}
              </span>
              <span className="pl-6 text-xs text-neutral-500">{opt.hint}</span>
            </label>
          ))}
        </div>

        {choice === "scheduled" && (
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="mt-3 h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm focus:border-primary-400 focus:outline-none"
          />
        )}

        {(validationError || errorMessage) && (
          <p className="mt-2 text-sm text-red-500">{validationError ?? errorMessage}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" variant="primary" onClick={handleConfirm} loading={submitting}>
            ยืนยัน
          </Button>
        </div>
      </div>
    </div>
  );
}
