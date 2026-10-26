"use client";

import dynamicImport from "next/dynamic";

// Quill ใช้ DOM ตอนโหลดโมดูล — โหลดฝั่ง client เท่านั้น (เหมือน ChapterEditorForm)
const QuillEditor = dynamicImport(
  () => import("@/components/writer/QuillEditor").then((m) => m.QuillEditor),
  { ssr: false, loading: () => <div className="h-[250px] animate-pulse rounded-lg bg-neutral-100" /> }
);

interface IntroductionEditorProps {
  defaultValue?: string;
  onChange: (html: string) => void;
}

/** ช่อง "แนะนำนิยาย" — จัดรูปแบบได้ (ตัวหนา/เอียง/จัดกลาง/สี/รายการ) แบบเดียวกับตอนเขียนตอน
 *  เก็บเป็น HTML ; API กรองแท็กก่อนบันทึก (lib/richText.ts) */
export function IntroductionEditor({ defaultValue, onChange }: IntroductionEditorProps) {
  // ข้อมูลเก่าเป็นข้อความธรรมดา — แตกบรรทัดเป็น <p> ก่อน ไม่งั้น Quill ยุบขึ้นบรรทัดใหม่ทิ้งหมด
  const initial =
    defaultValue && !/<[a-z][\s\S]*>/i.test(defaultValue)
      ? defaultValue
          .replace(/\r\n?/g, "\n")
          .split("\n")
          .map((line) => `<p>${line ? line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "<br>"}</p>`)
          .join("")
      : defaultValue;
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-neutral-700">แนะนำนิยาย (คำเกริ่นนำยาว)</p>
      <QuillEditor
        variant="basic"
        defaultValue={initial}
        onChange={onChange}
        placeholder="คำเตือนเนื้อหา รายละเอียดเพิ่มเติม คำโปรโมตฉบับยาว…"
      />
      <p className="mt-1.5 text-xs text-neutral-500">
        แสดงต่อท้ายเรื่องย่อในหน้านิยาย (ไม่บังคับ) — ตัวหนา เอียง จัดกึ่งกลาง ใส่สีได้เหมือนตอนเขียนตอน
      </p>
    </div>
  );
}
