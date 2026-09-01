"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface OnboardingTag {
  tag_id: number;
  name: string;
  category: "genre" | "mood" | "theme" | "pairing" | "fandom" | "freeform" | null;
  parent_tag_id?: number | null;
}

interface OnboardingWizardProps {
  tags: OnboardingTag[];
}

const ANY_GENRE = "ANY_GENRE";

/** เพิ่มภายหลัง (Phase Q, MASTER BRIEF) — Onboarding แบบ step-by-step บังคับตอบ 3 หน้า ไม่มีปุ่ม
 *  ข้าม (ตัดปุ่ม "ข้ามขั้นตอนนี้" เดิมออกทั้งหมดตามที่ระบุ — ดู SkipOnboardingLink.tsx ที่ถูกลบ)
 *  หน้า 1 = pairing, หน้า 2 = genre หลัก (มีตัวเลือก "อ่านได้ทุกแนว" พิเศษที่ไม่ผูกกับ tag จริง
 *  แค่ทำให้ผ่านเงื่อนไข "เลือกอย่างน้อย 1" โดยไม่ยัด tag_id ปลอมลง user_interests), หน้า 3 = freeform
 *  theme/trope — ส่งรวมทุกหน้าเป็น tag_ids เดียวตอนจบ (endpoint เดิม POST /users/me/interests
 *  รับ tag_ids: number[] อยู่แล้ว ไม่ต้องแก้ backend) */
export function OnboardingWizard({ tags }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pairingIds, setPairingIds] = useState<Set<number>>(new Set());
  const [genreIds, setGenreIds] = useState<Set<number>>(new Set());
  const [anyGenre, setAnyGenre] = useState(false);
  const [themeIds, setThemeIds] = useState<Set<number>>(new Set());

  const pairingTags = tags.filter((t) => t.category === "pairing");
  const genreTags = tags.filter((t) => t.category === "genre" && !t.parent_tag_id);
  const themeTags = tags.filter((t) => t.category === "freeform");

  const steps = [
    {
      title: "สายความสัมพันธ์ที่สนใจ?",
      subtitle: "เลือกได้หลายรายการ",
      options: pairingTags,
      selected: pairingIds,
      toggle: (id: number) =>
        setPairingIds((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        }),
      isValid: pairingIds.size > 0,
    },
    {
      title: "หมวดหมู่นิยายหลักที่ชอบ?",
      subtitle: "เลือกได้หลายรายการ หรือเลือก \"อ่านได้ทุกแนว\" ถ้าไม่จำกัด",
      options: genreTags,
      selected: genreIds,
      toggle: (id: number) =>
        setGenreIds((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          if (next.size > 0) setAnyGenre(false);
          return next;
        }),
      isValid: genreIds.size > 0 || anyGenre,
      extraOption: (
        <button
          type="button"
          onClick={() => {
            setAnyGenre((prev) => !prev);
            if (!anyGenre) setGenreIds(new Set());
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill border px-4 py-2 text-sm font-medium transition-colors",
            anyGenre
              ? "border-primary-500 bg-primary-500 text-white"
              : "border-dashed border-neutral-300 bg-white text-neutral-700 hover:border-primary-300 hover:bg-primary-50"
          )}
        >
          {anyGenre && <Check className="h-3.5 w-3.5" />}
          อ่านได้ทุกแนว
        </button>
      ),
    },
    {
      title: "ธีมและแนวเรื่องที่โดนใจ?",
      subtitle: "เลือกได้หลายรายการ",
      options: themeTags,
      selected: themeIds,
      toggle: (id: number) =>
        setThemeIds((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        }),
      isValid: themeIds.size > 0,
    },
  ];

  const current = steps[step];
  const isLastStep = step === steps.length - 1;

  async function handleNext() {
    if (!current.isValid) return;
    if (!isLastStep) {
      setStep((s) => s + 1);
      return;
    }

    setSubmitting(true);
    setError(null);
    const allTagIds = Array.from(new Set([...pairingIds, ...genreIds, ...themeIds]));
    try {
      const res = await fetch("/api/v1/users/me/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_ids: allTagIds }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("บันทึกความสนใจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        setSubmitting(false);
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-neutral-500">
          <span>
            ขั้นตอนที่ {step + 1} จาก {steps.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-neutral-100">
          <div
            className="h-full rounded-pill bg-primary-500 transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="text-center text-h3 text-neutral-900">{current.title}</h1>
      <p className="mt-1 text-center text-sm text-neutral-500">{current.subtitle}</p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {current.options.map((tag) => {
          const isSelected = current.selected.has(tag.tag_id);
          return (
            <button
              key={tag.tag_id}
              type="button"
              onClick={() => current.toggle(tag.tag_id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border px-4 py-2 text-sm font-medium transition-colors",
                isSelected
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-primary-300 hover:bg-primary-50"
              )}
            >
              {isSelected && <Check className="h-3.5 w-3.5" />}
              {tag.name}
            </button>
          );
        })}
        {"extraOption" in current && current.extraOption}
      </div>

      {current.options.length === 0 && !("extraOption" in current) && (
        <p className="mt-6 text-center text-sm text-neutral-500">ยังไม่มีตัวเลือกให้เลือกในตอนนี้</p>
      )}

      {error && <p className="mt-4 text-center text-sm text-red-500">{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={step === 0}>
          ย้อนกลับ
        </Button>
        <Button variant="tan" size="lg" disabled={!current.isValid} loading={submitting} onClick={handleNext}>
          {isLastStep ? "เสร็จสิ้น" : "ถัดไป"}
        </Button>
      </div>
    </div>
  );
}
