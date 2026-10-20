"use client";

/** แผงตั้งค่าการสุ่มแผนที่ + แผงตัวเลือกการส่งออกรูปภาพ — ใช้ใน WorldMap.tsx */

import { useState } from "react";
import { Dices, Download, Shuffle, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { GEN_KINDS, randomSeed, type GenKind, type GenSettings } from "@/components/writer/mapGenerator";

export function RandomMapPanel({
  hasContent,
  locationCount,
  onGenerate,
  onClose,
}: {
  /** มีสิ่งที่วาด/วางไว้แล้วไหม (ถ้ามี การสุ่มใหม่ทั้งหมดต้องยืนยันก่อน) */
  hasContent: boolean;
  locationCount: number;
  onGenerate: (settings: GenSettings, kinds: Set<GenKind>, replaceAll: boolean, moveLocations: boolean) => void;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<GenSettings>(() => ({ seed: randomSeed(), islands: 3, landSize: "medium", density: 0.55, settlements: 5 }));
  const [kinds, setKinds] = useState<Set<GenKind>>(() => new Set<GenKind>(["terrain", "water"]));
  const [moveLocations, setMoveLocations] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  function run(replaceAll: boolean) {
    onGenerate(settings, replaceAll ? new Set(GEN_KINDS.map((k) => k.key)) : kinds, replaceAll, moveLocations);
    // สุ่มรอบถัดไปได้ผลไม่ซ้ำเดิม (กดซ้ำได้หลายครั้ง) — ถ้าอยากได้ผลเดิมให้ใส่รหัสเดิมกลับเอง
    setSettings((s) => ({ ...s, seed: randomSeed() }));
    setConfirmAll(false);
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-primary-200 bg-primary-50/40 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
          <Dices className="h-4 w-4 text-primary-500" /> สุ่มสร้างแผนที่
        </p>
        <button type="button" onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          จำนวนเกาะ/ทวีป: <span className="font-semibold text-neutral-800">{settings.islands}</span>
          <input type="range" min={1} max={8} value={settings.islands} onChange={(e) => setSettings((s) => ({ ...s, islands: Number(e.target.value) }))} className="accent-primary-500" />
        </label>
        <div className="flex flex-col gap-1 text-xs text-neutral-600">
          ขนาดแผ่นดิน
          <div className="flex rounded-full bg-white p-0.5">
            {(
              [
                { key: "small", label: "เล็ก" },
                { key: "medium", label: "กลาง" },
                { key: "large", label: "ใหญ่" },
              ] as const
            ).map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setSettings((s) => ({ ...s, landSize: o.key }))}
                className={cn("flex-1 rounded-full px-2 py-1 text-xs font-medium transition", settings.landSize === o.key ? "bg-primary-500 text-white" : "text-neutral-500")}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          ความหนาแน่นภูมิประเทศ: <span className="font-semibold text-neutral-800">{Math.round(settings.density * 100)}%</span>
          <input type="range" min={0} max={100} value={Math.round(settings.density * 100)} onChange={(e) => setSettings((s) => ({ ...s, density: Number(e.target.value) / 100 }))} className="accent-primary-500" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          จำนวนเมือง/หมู่บ้าน: <span className="font-semibold text-neutral-800">{settings.settlements}</span>
          <input type="range" min={0} max={15} value={settings.settlements} onChange={(e) => setSettings((s) => ({ ...s, settlements: Number(e.target.value) }))} className="accent-primary-500" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
        <label className="flex items-center gap-1.5" title="ใส่รหัสเดิม + ตั้งค่าเดิม = ได้แผนที่เดิม">
          รหัสแผนที่
          <input
            type="number"
            value={settings.seed}
            onChange={(e) => setSettings((s) => ({ ...s, seed: Math.abs(Math.floor(Number(e.target.value) || 0)) }))}
            className="h-7 w-24 rounded-md border border-neutral-300 bg-white px-2 text-xs"
          />
          <button type="button" onClick={() => setSettings((s) => ({ ...s, seed: randomSeed() }))} className="rounded-md p-1 text-neutral-500 hover:bg-white" aria-label="สุ่มรหัสใหม่">
            <Shuffle className="h-3.5 w-3.5" />
          </button>
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={moveLocations}
            onChange={(e) => setMoveLocations(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-400"
          />
          สุ่มตำแหน่งหมุดสถานที่ของเรื่องด้วย ({locationCount} แห่ง รวมที่รอวาง)
        </label>
      </div>

      <div className="flex flex-col gap-2 border-t border-primary-100 pt-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs text-neutral-500">
            สุ่มเฉพาะที่เลือก — แทนที่เฉพาะสิ่งที่ระบบสุ่มสร้างไว้ของประเภทนั้น สิ่งที่คุณวางเองหรือแก้ไขแล้วจะไม่หาย
          </p>
          <div className="flex flex-wrap gap-1.5">
            {GEN_KINDS.map((k) => {
              const on = kinds.has(k.key);
              return (
                <button
                  key={k.key}
                  type="button"
                  onClick={() =>
                    setKinds((prev) => {
                      const next = new Set(prev);
                      if (next.has(k.key)) next.delete(k.key);
                      else next.add(k.key);
                      return next;
                    })
                  }
                  className={cn("rounded-pill border px-2.5 py-1 text-xs transition", on ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-300 bg-white text-neutral-600")}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={kinds.size === 0}
            onClick={() => run(false)}
            className="flex h-9 items-center gap-1.5 rounded-pill border border-primary-500 bg-white px-4 text-xs font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-40"
          >
            <Shuffle className="h-3.5 w-3.5" /> สุ่มเฉพาะที่เลือก
          </button>
          {confirmAll ? (
            <span className="flex items-center gap-1.5 rounded-pill bg-red-50 px-2 py-1 text-xs text-red-600">
              ลบทุกอย่างที่วาด/วางไว้แล้วสร้างใหม่? (ย้อนกลับได้)
              <button type="button" onClick={() => run(true)} className="rounded-pill bg-red-500 px-2.5 py-1 font-semibold text-white hover:bg-red-600">
                ยืนยัน
              </button>
              <button type="button" onClick={() => setConfirmAll(false)} className="px-1 text-neutral-500">
                ยกเลิก
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => (hasContent ? setConfirmAll(true) : run(true))}
              className="flex h-9 items-center gap-1.5 rounded-pill bg-primary-500 px-4 text-xs font-semibold text-white hover:bg-primary-600"
            >
              <Dices className="h-3.5 w-3.5" /> สุ่มแผนที่ใหม่ทั้งหมด
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export type ExportScope = "all" | "view";
export type ExportFormat = "png" | "jpeg";

export const EXPORT_SIZES = [
  { key: 2000, label: "มาตรฐาน (2000px)" },
  { key: 3000, label: "สูง (3000px)" },
  { key: 4000, label: "สูงมาก (4000px)" },
];

export function ExportPanel({
  exporting,
  onExport,
  onClose,
}: {
  exporting: boolean;
  onExport: (opts: { scope: ExportScope; size: number; format: ExportFormat }) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<ExportScope>("all");
  const [size, setSize] = useState(3000);
  const [format, setFormat] = useState<ExportFormat>("png");
  return (
    <div className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
      <span className="flex items-center gap-1.5 font-semibold text-neutral-800">
        <Download className="h-4 w-4" /> ส่งออกรูปภาพ
      </span>
      <select value={scope} onChange={(e) => setScope(e.target.value as ExportScope)} className="h-8 rounded-md border border-neutral-300 bg-white px-2" aria-label="ขอบเขต">
        <option value="all">ทั้งแผนที่</option>
        <option value="view">เฉพาะส่วนที่เห็นบนจอ</option>
      </select>
      <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-8 rounded-md border border-neutral-300 bg-white px-2" aria-label="ความละเอียด">
        {EXPORT_SIZES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} className="h-8 rounded-md border border-neutral-300 bg-white px-2" aria-label="ชนิดไฟล์">
        <option value="png">PNG (คมชัด ไม่เสียคุณภาพ)</option>
        <option value="jpeg">JPG (ไฟล์เล็กกว่า)</option>
      </select>
      <button
        type="button"
        disabled={exporting}
        onClick={() => onExport({ scope, size, format })}
        className="flex h-8 items-center gap-1.5 rounded-pill bg-primary-500 px-4 font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
      >
        {exporting ? "กำลังส่งออก..." : "ดาวน์โหลด"}
      </button>
      <button type="button" onClick={onClose} aria-label="ปิด" className="ml-auto text-neutral-400 hover:text-neutral-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
