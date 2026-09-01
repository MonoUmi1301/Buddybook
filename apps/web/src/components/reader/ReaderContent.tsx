"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type FontFamily = "sans" | "serif" | "reading";
type FontSize = "sm" | "md" | "lg" | "xl";
type ReaderTheme = "light" | "dark" | "sepia";

interface ReaderPrefs {
  fontFamily: FontFamily;
  fontSize: FontSize;
  theme: ReaderTheme;
}

const DEFAULT_PREFS: ReaderPrefs = { fontFamily: "sans", fontSize: "md", theme: "light" };
const STORAGE_KEY = "bb_reader_prefs";

const fontFamilyOptions: { value: FontFamily; label: string; cssVar: string }[] = [
  { value: "sans", label: "ปกติ", cssVar: "var(--font-ibm-plex-sans-thai)" },
  { value: "reading", label: "อ่านสบาย", cssVar: "var(--font-sarabun)" },
  { value: "serif", label: "หนังสือ", cssVar: "var(--font-noto-serif-thai)" },
];

const fontSizeOptions: { value: FontSize; label: string; px: number }[] = [
  { value: "sm", label: "เล็ก", px: 15 },
  { value: "md", label: "กลาง", px: 17 },
  { value: "lg", label: "ใหญ่", px: 19 },
  { value: "xl", label: "ใหญ่มาก", px: 22 },
];

const themeOptions: {
  value: ReaderTheme;
  label: string;
  swatchClass: string;
  bg: string;
  text: string;
  muted: string;
  border: string;
}[] = [
  { value: "light", label: "Light", swatchClass: "bg-white border border-neutral-300", bg: "#FFFFFF", text: "#262626", muted: "#737373", border: "#E5E5E5" },
  { value: "dark", label: "Dark", swatchClass: "bg-[#121212]", bg: "#121212", text: "#E4E4E4", muted: "#9A9A9A", border: "#2E2E2E" },
  { value: "sepia", label: "Sepia", swatchClass: "bg-[#F4ECD8] border border-[#D9C9A3]", bg: "#F4ECD8", text: "#5B4636", muted: "#8A7358", border: "#D9C9A3" },
];

function loadPrefs(): ReaderPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    return {
      fontFamily: fontFamilyOptions.some((o) => o.value === parsed.fontFamily) ? parsed.fontFamily! : DEFAULT_PREFS.fontFamily,
      fontSize: fontSizeOptions.some((o) => o.value === parsed.fontSize) ? parsed.fontSize! : DEFAULT_PREFS.fontSize,
      theme: themeOptions.some((o) => o.value === parsed.theme) ? parsed.theme! : DEFAULT_PREFS.theme,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

interface ReaderContentProps {
  novelId: string;
  novelTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  authorUsername: string;
  content: string;
  prevChapterId?: string;
  nextChapterId?: string;
}

/** เพิ่มภายหลัง (audit fix) — Toolbar ปรับฟอนต์/ขนาดตัวอักษร/ธีมตอนอ่าน แบบเดียวกับที่เจอในแอพอ่าน
 *  นิยายทั่วไป (ปุ่มลอย "Aa" มุมล่างขวา กดแล้วกางแผงตั้งค่าขึ้นมา) เก็บค่าไว้ที่ localStorage ต่อเครื่อง
 *  เหมือน pattern ของ ThemeProvider.tsx (ธีมเว็บ) แต่แยกกันคนละ key เพราะเป็นคนละเรื่อง — ธีมของหน้า
 *  อ่านตอนนี้เจตนาให้เลือกได้อิสระจากธีมเว็บ (เช่น เปิดเว็บโหมดสว่าง แต่จะอ่านด้วยโทนซีเปียก็ได้)
 *  default เป็น light/ปกติ/กลาง เหมือนกับตอน server-render เสมอ กันปัญหา hydration mismatch
 *  แล้วค่อยอ่านค่าจริงจาก localStorage ทับใน useEffect (ทำงานเฉพาะฝั่ง client)
 *
 *  แก้ตามฟีดแบ็ก — เดิมธีมนี้มีผลแค่พื้นหลัง/ตัวอักษรของ article เฉย ๆ ส่วนหัวข้อตอน/ชื่อผู้แต่ง/
 *  breadcrumb/ปุ่มตอนก่อนหน้า-ถัดไปรอบ ๆ ยังเป็นสีเดิมของเว็บ (ขาว) ทำให้ดูเหมือนธีมใช้งานได้แค่ครึ่ง
 *  เดียว จึงยกทั้งบล็อกการอ่าน (breadcrumb, หัวข้อตอน, เนื้อหา, ปุ่มตอนก่อนหน้า-ถัดไป) มาไว้ในนี้แทนที่
 *  จะแยกอยู่ใน page.tsx ให้ธีมคุมพื้นหลัง/ตัวอักษรของทั้งบล็อกจริง ๆ ไม่ใช่แค่กล่องเดียว — ส่วนคอมเมนต์
 *  ด้านล่างยังคงใช้ธีมเว็บปกติ (คนละเรื่องกับธีมการอ่าน) */
export function ReaderContent({
  novelId,
  novelTitle,
  chapterNumber,
  chapterTitle,
  authorUsername,
  content,
  prevChapterId,
  nextChapterId,
}: ReaderContentProps) {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function update(partial: Partial<ReaderPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const activeFont = fontFamilyOptions.find((o) => o.value === prefs.fontFamily)!;
  const activeSize = fontSizeOptions.find((o) => o.value === prefs.fontSize)!;
  const activeTheme = themeOptions.find((o) => o.value === prefs.theme)!;

  return (
    <div className="relative -mx-4 px-4 pb-8 transition-colors sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" ref={panelRef} style={{ backgroundColor: activeTheme.bg, color: activeTheme.text }}>
      <div className="mx-auto w-full max-w-3xl pt-4">
        <nav className="mb-4 text-sm" style={{ color: activeTheme.muted }}>
          <Link href={`/novels/${novelId}`} className="hover:underline">
            เรื่อง: {novelTitle}
          </Link>
        </nav>

        <h1 className="text-h2" style={{ color: activeTheme.text }}>
          ตอนที่ {chapterNumber}: {chapterTitle}
        </h1>
        <p className="mt-1 text-sm" style={{ color: activeTheme.muted }}>
          โดยนักเขียน {authorUsername}
        </p>

        <article
          className="prose prose-neutral mt-6 max-w-none transition-colors"
          style={{
            fontFamily: activeFont.cssVar,
            fontSize: `${activeSize.px}px`,
            color: activeTheme.text,
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />

        <div className="mt-8 flex items-center justify-between border-t pt-4" style={{ borderColor: activeTheme.border }}>
          {prevChapterId ? (
            <Link
              href={`/novels/${novelId}/chapters/${prevChapterId}`}
              className="flex items-center gap-1 text-sm font-medium hover:underline"
              style={{ color: activeTheme.muted }}
            >
              <ChevronLeft className="h-4 w-4" /> ตอนก่อนหน้า
            </Link>
          ) : (
            <span />
          )}
          {nextChapterId ? (
            <Link
              href={`/novels/${novelId}/chapters/${nextChapterId}`}
              className="flex items-center gap-1 text-sm font-medium hover:underline"
              style={{ color: activeTheme.muted }}
            >
              ตอนถัดไป <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="ตั้งค่าการอ่าน"
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary-500 text-base font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-600"
      >
        Aa
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-30 w-72 rounded-card border border-neutral-200 bg-white p-4 shadow-xl">
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold text-neutral-500">รูปแบบตัวอักษร</p>
            <div className="flex gap-2">
              {fontFamilyOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ fontFamily: opt.value })}
                  style={{ fontFamily: opt.cssVar }}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 rounded-lg border-2 py-2 text-sm transition-colors",
                    prefs.fontFamily === opt.value
                      ? "border-primary-400 bg-primary-50 text-primary-700"
                      : "border-neutral-200 text-neutral-600 hover:border-primary-300"
                  )}
                >
                  <span className="text-base">Aa</span>
                  <span className="text-[10px]">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold text-neutral-500">ขนาดตัวอักษร</p>
            <div className="flex gap-2">
              {fontSizeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ fontSize: opt.value })}
                  aria-label={opt.label}
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-lg border-2 py-2 font-semibold text-neutral-700 transition-colors",
                    prefs.fontSize === opt.value
                      ? "border-primary-400 bg-primary-50 text-primary-700"
                      : "border-neutral-200 hover:border-primary-300"
                  )}
                  title={opt.label}
                >
                  <span style={{ fontSize: `${Math.min(opt.px, 20)}px` }}>A</span>
                </button>
              ))}
            </div>
            <p className="mt-1 text-center text-[11px] text-neutral-400">{activeSize.label}</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-neutral-500">ธีมการอ่าน</p>
            <div className="flex gap-2">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ theme: opt.value })}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-lg border-2 py-2 text-[11px] text-neutral-600 transition-colors",
                    prefs.theme === opt.value ? "border-primary-400 bg-primary-50" : "border-neutral-200 hover:border-primary-300"
                  )}
                >
                  <span className={cn("relative flex h-6 w-6 items-center justify-center rounded-full", opt.swatchClass)}>
                    {prefs.theme === opt.value && (
                      <Check className={cn("h-3.5 w-3.5", opt.value === "light" ? "text-neutral-700" : "text-white")} />
                    )}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
