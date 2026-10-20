"use client";

/** เครื่องมือแก้ไขวัตถุบนแผนที่: กรอบย้าย/ย่อขยาย/หมุน (TransformGizmo), คลังชิ้นส่วน (PiecesLibrary),
 *  และแถบคุณสมบัติของชิ้นส่วน/ชื่อพื้นที่ที่เลือกอยู่ — ใช้ใน WorldMap.tsx */

import { useEffect, useRef, useState } from "react";
import { useViewport } from "@xyflow/react";
import {
  ChevronsDown,
  ChevronsUp,
  Copy,
  FlipHorizontal,
  Italic,
  Link2Off,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { LAND_PRESETS, WATER_PRESETS } from "@/components/writer/MapTerrain";
import { PIECE_CATEGORIES, PIECE_DEFS, PieceThumbnail, type MapPiece, type PieceCategory, type PieceDef } from "@/components/writer/mapPieces";
import {
  LABEL_CATEGORIES,
  LABEL_COLORS,
  LABEL_FONTS,
  LABEL_MAX_SIZE,
  LABEL_MIN_SIZE,
  type LabelCategory,
  type LabelFont,
  type MapLabel,
} from "@/components/writer/MapLabels";

export const PIECE_DRAG_MIME = "application/x-buddybook-map-piece";
export const PIECE_MIN_SCALE = 0.1;
export const PIECE_MAX_SCALE = 10;

/** ปุ่มสีที่กดแล้วเปิดตัวเลือกสีของเบราว์เซอร์ (เลือกสีอะไรก็ได้นอกเหนือจากพรีเซ็ต) */
export function ColorInputSwatch({ value, title, onChange }: { value: string; title: string; onChange: (color: string) => void }) {
  return (
    <label
      title={title}
      className="relative h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded-full border border-neutral-300 transition hover:scale-110"
      style={{ background: value }}
    >
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={title} />
    </label>
  );
}

// ---------------- กรอบแปลงรูป ----------------

export type GizmoPatch = { dx: number; dy: number } | { factor: number } | { rotation: number };

/** กรอบรอบวัตถุที่เลือก: ลากในกรอบ = ย้าย, จุดมุมขวาล่าง = ย่อ/ขยาย, ปุ่มกลมด้านบน = หมุน
 *  (กด Shift ค้างตอนหมุน = ล็อกทีละ 15°) — พิกัด/ขนาดคำนวณจาก viewport ของแคนวาส */
export function TransformGizmo({
  x,
  y,
  rotation,
  bounds,
  canScale = true,
  canRotate = true,
  onStart,
  onPreview,
  onEnd,
  onWheelZoom,
}: {
  x: number;
  y: number;
  rotation: number;
  /** ขอบเขตรอบจุด (x, y) ในหน่วยแผนที่ ก่อนหมุน */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  canScale?: boolean;
  canRotate?: boolean;
  onStart: () => void;
  onPreview: (patch: GizmoPatch) => void;
  onEnd: (changed: boolean) => void;
  onWheelZoom: (e: WheelEvent) => void;
}) {
  const { x: vx, y: vy, zoom } = useViewport();
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    type: "move" | "scale" | "rotate";
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    startDist: number;
    startAngle: number;
    startRotation: number;
    changed: boolean;
  } | null>(null);

  // ซูมด้วยล้อเมาส์ได้แม้เคอร์เซอร์อยู่บนกรอบ (กรอบบังพื้นแคนวาสที่รับ wheel ตามปกติ)
  const wheelRef = useRef(onWheelZoom);
  wheelRef.current = onWheelZoom;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const left = (x + bounds.minX) * zoom + vx;
  const top = (y + bounds.minY) * zoom + vy;
  const width = Math.max(12, (bounds.maxX - bounds.minX) * zoom);
  const height = Math.max(12, (bounds.maxY - bounds.minY) * zoom);
  const originX = -bounds.minX * zoom;
  const originY = -bounds.minY * zoom;

  function begin(type: "move" | "scale" | "rotate", e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const pane = (e.currentTarget as HTMLElement).closest(".react-flow")?.getBoundingClientRect();
    const ox = (pane?.left ?? 0) + x * zoom + vx;
    const oy = (pane?.top ?? 0) + y * zoom + vy;
    dragRef.current = {
      type,
      sx: e.clientX,
      sy: e.clientY,
      ox,
      oy,
      startDist: Math.max(1, Math.hypot(e.clientX - ox, e.clientY - oy)),
      startAngle: (Math.atan2(e.clientY - oy, e.clientX - ox) * 180) / Math.PI,
      startRotation: rotation,
      changed: false,
    };
    onStart();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // pointer หายไปแล้ว (เช่น ปล่อยนิ้วเร็วมาก) — ลากต่อได้ตามปกติแค่ไม่ capture
    }
  }

  function move(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.changed && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
    d.changed = true;
    if (d.type === "move") {
      onPreview({ dx: (e.clientX - d.sx) / zoom, dy: (e.clientY - d.sy) / zoom });
    } else if (d.type === "scale") {
      onPreview({ factor: Math.hypot(e.clientX - d.ox, e.clientY - d.oy) / d.startDist });
    } else {
      const angle = (Math.atan2(e.clientY - d.oy, e.clientX - d.ox) * 180) / Math.PI;
      let next = d.startRotation + angle - d.startAngle;
      if (e.shiftKey) next = Math.round(next / 15) * 15;
      onPreview({ rotation: Math.round(((next % 360) + 360) % 360) });
    }
  }

  function end(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    onEnd(d.changed);
  }

  const handlers = (type: "move" | "scale" | "rotate") => ({
    onPointerDown: (e: React.PointerEvent) => begin(type, e),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  });

  return (
    <div
      ref={boxRef}
      className="nodrag nopan absolute touch-none"
      style={{
        left,
        top,
        width,
        height,
        zIndex: 54,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: `${originX}px ${originY}px`,
      }}
    >
      <div className="absolute inset-0 cursor-move rounded border-2 border-dashed border-orange-500/90 bg-orange-400/5" {...handlers("move")} />
      {canRotate && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 -translate-y-full bg-orange-500" />
          <div
            title="ลากเพื่อหมุน (Shift = ทีละ 15°)"
            className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-[calc(100%+1.25rem)] cursor-grab rounded-full border-2 border-orange-500 bg-white shadow"
            {...handlers("rotate")}
          />
        </>
      )}
      {canScale && (
        <div
          title="ลากเพื่อย่อ/ขยาย"
          className="absolute bottom-0 right-0 h-3.5 w-3.5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-sm border-2 border-orange-500 bg-white shadow"
          {...handlers("scale")}
        />
      )}
    </div>
  );
}

// ---------------- คลังชิ้นส่วน ----------------

export function PiecesLibrary({
  onAddPiece,
  onAddLabel,
}: {
  onAddPiece: (key: string) => void;
  onAddLabel: (category: LabelCategory) => void;
}) {
  const [category, setCategory] = useState<PieceCategory>("land");
  const defs = PIECE_DEFS.filter((d) => d.category === category);
  return (
    <div className="w-full space-y-2 rounded-lg border border-neutral-200 bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center rounded-full bg-neutral-100 p-0.5">
          {PIECE_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={cn("rounded-full px-3 py-1 text-xs font-medium transition", category === c.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-neutral-500">
          <Type className="h-3.5 w-3.5" /> เพิ่มชื่อ
          {LABEL_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onAddLabel(c.key)}
              className="rounded-pill border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:border-primary-400 hover:text-primary-500"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {defs.map((d) => (
          <button
            key={d.key}
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(PIECE_DRAG_MIME, d.key);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => onAddPiece(d.key)}
            title={`ลากลงแผนที่ หรือกดเพื่อวางกลางจอ — ${d.label}`}
            className="flex w-[5.5rem] shrink-0 cursor-grab flex-col items-center gap-1 rounded-lg border border-neutral-200 bg-sky-50/60 p-1.5 transition hover:border-primary-400 active:cursor-grabbing"
          >
            <PieceThumbnail def={d} size={60} />
            <span className="w-full truncate text-center text-[11px] text-neutral-600">{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- แถบคุณสมบัติ ----------------

const barBtn = "flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 disabled:opacity-40";

function LayerAndActions({
  onLayer,
  onDuplicate,
  onDelete,
  onClose,
}: {
  onLayer: (dir: "front" | "back") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <span className="mx-0.5 h-5 w-px bg-neutral-200" />
      <button type="button" className={barBtn} title="เอาไว้หน้าสุด" onClick={() => onLayer("front")}>
        <ChevronsUp className="h-4 w-4" />
      </button>
      <button type="button" className={barBtn} title="เอาไว้หลังสุด" onClick={() => onLayer("back")}>
        <ChevronsDown className="h-4 w-4" />
      </button>
      <button type="button" className={barBtn} title="ทำซ้ำ" onClick={onDuplicate}>
        <Copy className="h-4 w-4" />
      </button>
      <button type="button" className={cn(barBtn, "text-red-500 hover:bg-red-50")} title="ลบ" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </button>
      <button type="button" className={barBtn} title="ยกเลิกการเลือก" onClick={onClose}>
        <X className="h-4 w-4" />
      </button>
    </>
  );
}

export function PiecePropertiesBar({
  piece,
  def,
  onChange,
  onLayer,
  onDuplicate,
  onDelete,
  onClose,
  onAddLabel,
}: {
  piece: MapPiece;
  def: PieceDef;
  onChange: (patch: Partial<Pick<MapPiece, "scale" | "rotation" | "flipX" | "color">>) => void;
  onLayer: (dir: "front" | "back") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  onAddLabel: () => void;
}) {
  const scale = piece.scale ?? 1;
  const rotation = piece.rotation ?? 0;
  const presets = def.primary === "water" ? WATER_PRESETS : LAND_PRESETS;
  const color = piece.color ?? def.color;
  return (
    <div className="flex w-full flex-wrap items-center gap-1 rounded-lg border border-orange-200 bg-orange-50/60 p-1.5">
      <span className="px-1 text-xs font-semibold text-neutral-700">{def.label}</span>
      <span className="mx-0.5 h-5 w-px bg-neutral-200" />
      <button type="button" className={barBtn} title="ย่อ" disabled={scale <= PIECE_MIN_SCALE} onClick={() => onChange({ scale: Math.max(PIECE_MIN_SCALE, Math.round((scale / 1.15) * 100) / 100) })}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-10 text-center text-[11px] text-neutral-500">{Math.round(scale * 100)}%</span>
      <button type="button" className={barBtn} title="ขยาย" disabled={scale >= PIECE_MAX_SCALE} onClick={() => onChange({ scale: Math.min(PIECE_MAX_SCALE, Math.round(scale * 1.15 * 100) / 100) })}>
        <Plus className="h-4 w-4" />
      </button>
      <button type="button" className={barBtn} title="หมุนซ้าย 15°" onClick={() => onChange({ rotation: (rotation - 15 + 360) % 360 })}>
        <RotateCcw className="h-4 w-4" />
      </button>
      <span className="w-8 text-center text-[11px] text-neutral-500">{Math.round(rotation)}°</span>
      <button type="button" className={barBtn} title="หมุนขวา 15°" onClick={() => onChange({ rotation: (rotation + 15) % 360 })}>
        <RotateCw className="h-4 w-4" />
      </button>
      <button type="button" className={cn(barBtn, piece.flipX && "bg-white text-primary-500")} title="พลิกซ้าย-ขวา" onClick={() => onChange({ flipX: !piece.flipX })}>
        <FlipHorizontal className="h-4 w-4" />
      </button>
      <span className="mx-0.5 h-5 w-px bg-neutral-200" />
      <div className="flex items-center gap-1">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            title={p.label}
            aria-label={`สี${p.label}`}
            onClick={() => onChange({ color: p.color })}
            className={cn("h-5 w-5 rounded-full border border-neutral-300 transition hover:scale-110", color.toLowerCase() === p.color.toLowerCase() && "ring-2 ring-primary-500 ring-offset-1")}
            style={{ background: p.color }}
          />
        ))}
        <ColorInputSwatch value={color} title="เลือกสีเอง" onChange={(c) => onChange({ color: c })} />
      </div>
      <span className="mx-0.5 h-5 w-px bg-neutral-200" />
      <button type="button" className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-neutral-600 hover:bg-neutral-100" title="เพิ่มชื่อที่ผูกกับชิ้นนี้" onClick={onAddLabel}>
        <Type className="h-4 w-4" /> ตั้งชื่อ
      </button>
      <LayerAndActions onLayer={onLayer} onDuplicate={onDuplicate} onDelete={onDelete} onClose={onClose} />
    </div>
  );
}

export function LabelPropertiesBar({
  label,
  attachedName,
  onChange,
  onTextChange,
  onLayer,
  onDuplicate,
  onDelete,
  onClose,
}: {
  label: MapLabel;
  attachedName: string | null;
  onChange: (patch: Partial<MapLabel>) => void;
  /** พิมพ์ชื่อ — WorldMap หน่วงการบันทึก/undo ไว้จนหยุดพิมพ์ */
  onTextChange: (text: string) => void;
  onLayer: (dir: "front" | "back") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const rotation = label.rotation ?? 0;
  return (
    <div className="flex w-full flex-wrap items-center gap-1 rounded-lg border border-orange-200 bg-orange-50/60 p-1.5">
      <input
        value={label.text}
        maxLength={80}
        onChange={(e) => onTextChange(e.target.value)}
        // ลบชื่อจนว่างแล้วออกจากช่อง — ใส่ชื่อชั่วคราวให้ ไม่งั้นชื่อจะมองไม่เห็นและคลิกเลือกไม่ได้อีก
        onBlur={(e) => {
          if (!e.target.value.trim()) onTextChange("ไม่มีชื่อ");
        }}
        aria-label="ชื่อพื้นที่"
        className="h-7 w-40 rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-800 outline-none focus:border-primary-400"
      />
      <select
        value={label.category ?? ""}
        onChange={(e) => {
          const cat = LABEL_CATEGORIES.find((c) => c.key === e.target.value);
          if (cat) onChange({ category: cat.key, ...cat.preset });
        }}
        aria-label="ประเภทชื่อ"
        className="h-7 rounded-md border border-neutral-300 bg-white px-1 text-xs text-neutral-700"
      >
        <option value="" disabled>
          ประเภท
        </option>
        {LABEL_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
      <select
        value={label.font}
        onChange={(e) => onChange({ font: e.target.value as LabelFont })}
        aria-label="แบบตัวอักษร"
        className="h-7 rounded-md border border-neutral-300 bg-white px-1 text-xs text-neutral-700"
      >
        {LABEL_FONTS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
      <button type="button" className={barBtn} title="เล็กลง" disabled={label.size <= LABEL_MIN_SIZE} onClick={() => onChange({ size: Math.max(LABEL_MIN_SIZE, Math.round(label.size / 1.15)) })}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-7 text-center text-[11px] text-neutral-500">{Math.round(label.size)}</span>
      <button type="button" className={barBtn} title="ใหญ่ขึ้น" disabled={label.size >= LABEL_MAX_SIZE} onClick={() => onChange({ size: Math.min(LABEL_MAX_SIZE, Math.round(label.size * 1.15)) })}>
        <Plus className="h-4 w-4" />
      </button>
      <button type="button" className={cn(barBtn, label.italic && "bg-white text-primary-500")} title="ตัวเอียง" onClick={() => onChange({ italic: !label.italic })}>
        <Italic className="h-4 w-4" />
      </button>
      <label className="flex items-center gap-1 text-[11px] text-neutral-500" title="ระยะห่างตัวอักษร">
        ห่าง
        <input
          type="range"
          min={0}
          max={0.8}
          step={0.05}
          value={label.spacing ?? 0}
          onChange={(e) => onChange({ spacing: Number(e.target.value) })}
          className="w-16 accent-primary-500"
        />
      </label>
      <button type="button" className={barBtn} title="หมุนซ้าย 15°" onClick={() => onChange({ rotation: (rotation - 15 + 360) % 360 })}>
        <RotateCcw className="h-4 w-4" />
      </button>
      <button type="button" className={barBtn} title="หมุนขวา 15°" onClick={() => onChange({ rotation: (rotation + 15) % 360 })}>
        <RotateCw className="h-4 w-4" />
      </button>
      <span className="mx-0.5 h-5 w-px bg-neutral-200" />
      <div className="flex items-center gap-1">
        {LABEL_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`สีตัวอักษร ${c}`}
            onClick={() => onChange({ color: c })}
            className={cn("h-5 w-5 rounded-full border border-neutral-300 transition hover:scale-110", label.color.toLowerCase() === c && "ring-2 ring-primary-500 ring-offset-1")}
            style={{ background: c }}
          />
        ))}
        <ColorInputSwatch value={label.color} title="เลือกสีเอง" onChange={(c) => onChange({ color: c })} />
      </div>
      {attachedName && (
        <button
          type="button"
          className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-neutral-600 hover:bg-neutral-100"
          title={`ชื่อนี้เลื่อนตาม "${attachedName}" — กดเพื่อเลิกผูก`}
          onClick={() => onChange({ attachTo: undefined })}
        >
          <Link2Off className="h-3.5 w-3.5" /> ผูกกับ {attachedName}
        </button>
      )}
      <LayerAndActions onLayer={onLayer} onDuplicate={onDuplicate} onDelete={onDelete} onClose={onClose} />
    </div>
  );
}
