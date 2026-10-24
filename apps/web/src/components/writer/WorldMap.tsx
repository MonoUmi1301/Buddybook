"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  ConnectionMode,
  Position,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  useViewport,
  useReactFlow,
  useStore,
  ReactFlowProvider,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Hand,
  MapPinned,
  Pencil,
  PaintBucket,
  Stamp,
  Trash2,
  X,
  History,
  Save,
  Download,
  Undo2,
  Redo2,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Puzzle,
  Dices,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/Toaster";
import { Button } from "@/components/ui/Button";
import { LocationNode, locationNodeSize, type LocationNodeData } from "@/components/writer/LocationNode";
import {
  MapAssetIcon,
  MapInkFilterDefs,
  SvgStamp,
  stampBaseSize,
  STAMP_OPTIONS,
  getLocationAsset,
  getStampAsset,
  type LocationIconKey,
  type StampIconKey,
} from "@/components/writer/mapAssets";
import { AddLocationModal } from "@/components/writer/AddLocationModal";
import {
  BASE_ID,
  BASE_PRESETS,
  DEFAULT_BASE,
  LAND_PRESETS,
  WATER_PRESETS,
  TerrainLayer,
  TerrainStrokePreview,
  pointsToSvgPath,
  type LandMode,
  type LandStroke,
  type MapBase,
  type TerrainItem,
} from "@/components/writer/MapTerrain";
import { PieceFeatures, fromPieceLocal, getPieceDef, hitPiece, toPieceLocal, type MapPiece } from "@/components/writer/mapPieces";
import { generateMap, type GenElement, type GenKind, type GenSettings } from "@/components/writer/mapGenerator";
import { ExportPanel, RandomMapPanel, type ExportFormat, type ExportScope } from "@/components/writer/MapGeneratorPanel";
import { LABEL_CATEGORIES, LabelsLayer, estimateLabelBox, hitLabel, type LabelBox, type LabelCategory, type MapLabel } from "@/components/writer/MapLabels";
import {
  ColorInputSwatch,
  LabelPropertiesBar,
  PIECE_DRAG_MIME,
  PIECE_MAX_SCALE,
  PIECE_MIN_SCALE,
  PiecePropertiesBar,
  PiecesLibrary,
  TransformGizmo,
  type GizmoPatch,
} from "@/components/writer/MapEditTools";
import { LoreModal, type ChapterOption } from "@/components/writer/LoreModal";
import { THAI_TIME_ZONE } from "@/lib/format";
import { formatApiError } from "@/lib/formatApiError";

const nodeTypes = { locationNode: LocationNode };

export interface LocationRecord {
  location_id: string;
  name: string;
  icon: LocationIconKey;
  category?: string;
  pos_x: number | null;
  pos_y: number | null;
  scale?: number;
  rotation?: number;
  flip_x?: boolean;
  z_index?: number;
  linked_chapter_id?: string | null;
  description?: string | null;
}

// เพิ่มภายหลัง (audit fix) — องค์ประกอบอิสระบนแผนที่: เส้นวาดมือ ("line"), พื้นที่ระบายภูมิประเทศ
// แบบปิดรูป ("fill", เลิกสร้างใหม่แล้วแต่ยังต้องเรนเดอร์ข้อมูลเก่าได้), ไอคอนปั๊มสิ่งกีดขวางแบบวาง
// ต่อเนื่อง ("stamp"), และ Land Tool แบบแปรงเพิ่ม/ลบพื้นที่ดิน ("land", ดู DrawingLayer สำหรับ
// การ composite ผ่าน SVG mask — ต่างจาก "fill" ตรงที่ใช้ขนาดแปรงแทนการลากปิดรูปทรงตรง ๆ)
export type MapElement =
  | { id: string; kind?: "line"; points: { x: number; y: number }[]; width: number; color?: string }
  | { id: string; kind: "fill"; points: { x: number; y: number }[]; color: string }
  | LandStroke
  | MapBase
  | MapPiece
  | MapLabel
  | { id: string; kind: "stamp"; icon: string; x: number; y: number; rotation?: number; scale?: number; color?: string; gen?: GenKind };

type StampElement = Extract<MapElement, { kind: "stamp" }>;
type LineElement = Extract<MapElement, { points: unknown; width: number }>;

function isLineElement(el: MapElement): el is LineElement {
  return el.kind === undefined || el.kind === "line";
}

// ระยะจากจุดถึงส่วนของเส้นตรง a–b — ใช้หาว่าคลิกโดนเส้นวาดมือเส้นไหน
function distanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export type MapDrawing = MapElement;

interface WorldMapProps {
  novelId: string;
  initialLocations: LocationRecord[];
  initialEdges: Edge[];
  initialDrawings: MapDrawing[];
  chapters: ChapterOption[];
}

// สีของสแตมป์ — null = สีเดิมของภาพ/ไอคอน
const STAMP_COLORS: { label: string; color: string | null }[] = [
  { label: "เดิม", color: null },
  { label: "ดำ", color: "#1c1917" },
  { label: "น้ำตาล", color: "#92400e" },
  { label: "เขียว", color: "#15803d" },
  { label: "น้ำเงิน", color: "#1d4ed8" },
  { label: "แดง", color: "#dc2626" },
  { label: "ม่วง", color: "#7c3aed" },
  { label: "ขาว", color: "#ffffff" },
];
const STAMP_MIN_SCALE = 0.3;
const STAMP_MAX_SCALE = 3;

function clampStampScale(v: number): number {
  return Math.round(Math.min(STAMP_MAX_SCALE, Math.max(STAMP_MIN_SCALE, v)) * 10) / 10;
}

// ขนาดโหนด + จุดต่อเส้น 4 ทิศ คำนวณตาม scale — โหนดต้องโตตามไอคอนจริง ไม่งั้นป้ายชื่อถูกไอคอนที่ขยายทับ
function locationNodeLayout(scale: number) {
  const { width, height, iconBox } = locationNodeSize(scale);
  return {
    width,
    height,
    handles: [
      { id: "top", type: "source" as const, position: Position.Top, x: width / 2, y: 0 },
      { id: "right", type: "source" as const, position: Position.Right, x: width, y: iconBox / 2 },
      { id: "bottom", type: "source" as const, position: Position.Bottom, x: width / 2, y: height },
      { id: "left", type: "source" as const, position: Position.Left, x: 0, y: iconBox / 2 },
    ],
  };
}

// พรีเซ็ตสีภูมิประเทศอยู่ใน MapTerrain.tsx (LAND_PRESETS / WATER_PRESETS / BASE_PRESETS)

// รายการ stamp (ภาพวาด/ไอคอน) อยู่ใน mapAssets.tsx

// ระยะห่างขั้นต่ำ (px ในพิกัดแคนวาส) ก่อนวางไอคอนปั๊มถัดไปตอนลากต่อเนื่อง กันไอคอนถี่เกินไป
const MIN_STAMP_SPACING = 36;

function toFlowNode(
  loc: LocationRecord,
  x: number,
  y: number,
  callbacks: {
    onRename: (id: string, name: string) => void;
    onTransform: (id: string, patch: { scale?: number; rotation?: number; flip_x?: boolean }) => void;
    onLayerOrder: (id: string, direction: "front" | "back") => void;
    onOpenLore: (id: string) => void;
    onDelete: (id: string) => void;
  }
): Node<LocationNodeData> {
  return {
    id: loc.location_id,
    type: "locationNode",
    position: { x, y },
    zIndex: loc.z_index ?? 0,
    data: {
      name: loc.name,
      icon: loc.icon,
      scale: loc.scale ?? 1,
      rotation: loc.rotation ?? 0,
      flipX: loc.flip_x ?? false,
      ...callbacks,
    },
    // เพิ่มภายหลัง (audit fix) — ผู้ใช้ขอให้ลากถนนได้อิสระรอบไอคอน ไม่ใช่แค่ซ้าย-ขวา จึงเพิ่มเป็น
    // 4 ทิศ ทุกจุดเป็น source ทั้งหมด คู่กับ connectionMode="loose" ด้านล่าง (เหมือน CharacterGraph)
    ...locationNodeLayout(loc.scale ?? 1),
  };
}

function isPlaced(l: LocationRecord): boolean {
  return l.pos_x !== null && l.pos_y !== null;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Land Tool — คำนวณครั้งเดียวตอนปล่อยเมาส์ (pointer up) ไม่ใช่ทุก frame ระหว่างลาก เพื่อไม่ให้หนักเว็บ
function jitterPoints(points: { x: number; y: number }[], amount: number): { x: number; y: number }[] {
  if (amount <= 0) return points;
  return points.map((p) => ({
    // ความขรุขระของเส้นที่วาด ไม่เกี่ยวกับความปลอดภัย
    x: p.x + (Math.random() - 0.5) * amount, // NOSONAR
    y: p.y + (Math.random() - 0.5) * amount, // NOSONAR
  }));
}

// Chaikin's corner-cutting — ทำให้เส้นที่ลากด้วยเมาส์ (มีมุมหยักตามตำแหน่งจุดดิบ) ดูโค้งมนเป็นธรรมชาติ
// โดยไม่ต้องพึ่งไลบรารีเรขาคณิตภายนอก
function smoothPoints(points: { x: number; y: number }[], iterations = 2): { x: number; y: number }[] {
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    if (pts.length < 3) break;
    const next: { x: number; y: number }[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      next.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 });
      next.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

// สคีมาบันทึกรับได้ไม่เกิน 2000 จุดต่อเส้น — ตัดจุดที่ถี่เกินก่อน smooth (Chaikin เพิ่มจุดราว 4 เท่า)
// แล้วสุ่มเก็บแบบเว้นระยะถ้ายังเกิน กันเส้นยาว ๆ บันทึกไม่ผ่านแบบเงียบ ๆ
function thinPoints(points: { x: number; y: number }[], minGap: number): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (distance(out[out.length - 1], points[i]) >= minGap) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

function capPoints(points: { x: number; y: number }[], max = 1900): { x: number; y: number }[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

// ก่อนมีแปรงน้ำ "ทะเล" เป็นแค่สีหนึ่งของแปรงแผ่นดิน — แผนที่เก่าที่ระบายทะเลไว้จะถูกวาดเป็นแผ่นดิน
// สีฟ้าที่มีเส้นขอบชายฝั่ง จึงแปลงเส้นแผ่นดินสีทะเลเดิมให้เป็นน้ำจริงตามที่ผู้ใช้ตั้งใจ
const LEGACY_SEA_COLOR = "#5fa8d3";
function migrateLegacySea(el: MapElement): MapElement {
  if (el.kind === "land" && el.mode === "add" && el.color.toLowerCase() === LEGACY_SEA_COLOR) return { ...el, mode: "water" as const };
  return el;
}

type ActiveStroke =
  | { kind: "line"; points: { x: number; y: number }[]; width: number }
  | { kind: "land"; points: { x: number; y: number }[]; color: string; brushSize: number; landMode: LandMode; closed: boolean };

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

/** เลเยอร์แสดงองค์ประกอบอิสระบนแผนที่ (เส้น/พื้นที่ระบายสี/ไอคอนปั๊ม/Land Tool) ซิงก์ตำแหน่งตามการ
 *  pan/zoom ของแคนวาสผ่าน useViewport() — เรนเดอร์เป็น <svg> ซ้อนอยู่ใต้เลเยอร์ตัวโหนดสถานที่
 *  Land Tool ("land") composite ผ่าน SVG <mask>: stroke สีขาว = เพิ่มพื้นที่, สีดำ = ลบพื้นที่
 *  เรียงตามลำดับที่วาด (stroke หลังทับ stroke ก่อนที่จุดเดียวกัน) — เลือกวิธีนี้เพราะเบากว่ามาก
 *  เทียบกับ raster masking หรือไลบรารี polygon-boolean และ browser จัดการ stroke-to-fill ให้เอง */
function DrawingLayer({
  elements,
  activeStroke,
  selectedElementId,
  labelBoxesRef,
}: {
  elements: MapElement[];
  activeStroke: ActiveStroke | null;
  selectedElementId: string | null;
  labelBoxesRef: React.MutableRefObject<Map<string, LabelBox>>;
}) {
  const { x, y, zoom } = useViewport();
  const paneWidth = useStore((st) => st.width);
  const paneHeight = useStore((st) => st.height);
  // ภูมิประเทศ = เส้นแปรง + ชิ้นส่วนแผนที่ เรียงตามลำดับชั้นเดียวกัน (ชิ้นที่อยู่หลังทับชิ้นก่อน)
  const terrainItems = elements.filter((el): el is TerrainItem => el.kind === "land" || el.kind === "piece");
  const pieces = elements.filter((el): el is MapPiece => el.kind === "piece");
  const labels = elements.filter((el): el is MapLabel => el.kind === "label");
  const base = (elements.find((el) => el.kind === "base") as MapBase | undefined) ?? DEFAULT_BASE;
  const otherElements = elements.filter((el) => el.kind !== "land" && el.kind !== "base" && el.kind !== "piece" && el.kind !== "label");
  const activeLand = activeStroke?.kind === "land" ? activeStroke : null;
  // พื้นที่ที่มองเห็น (พิกัดแผนที่) + ขอบเผื่อสำหรับเงา/ขอบชายฝั่ง — ฟิลเตอร์คำนวณแค่ในกรอบนี้
  const pad = 80;
  const view = { x: -x / zoom - pad, y: -y / zoom - pad, w: paneWidth / zoom + pad * 2, h: paneHeight / zoom + pad * 2 };

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        <TerrainLayer strokes={terrainItems} base={base} view={view} />
        {pieces.map((pc) => (
          <PieceFeatures key={pc.id} piece={pc} />
        ))}
        {activeLand && (
          <TerrainStrokePreview
            stroke={{ points: activeLand.points, brushSize: activeLand.brushSize, mode: activeLand.landMode, color: activeLand.color, closed: activeLand.closed }}
            zoom={zoom}
          />
        )}

        {otherElements.map((el) => {
          if (el.kind === "fill") {
            return <path key={el.id} d={pointsToSvgPath(el.points, true)} fill={el.color} fillOpacity={0.45} stroke={el.color} strokeWidth={1} />;
          }
          if (el.kind === "stamp") {
            const asset = getStampAsset(el.icon);
            const half = (stampBaseSize(asset) * (el.scale ?? 1)) / 2 + 4;
            return (
              <g key={el.id}>
                <SvgStamp asset={asset} x={el.x} y={el.y} scale={el.scale ?? 1} rotation={el.rotation} color={el.color} />
                {el.id === selectedElementId && (
                  <rect
                    x={el.x - half}
                    y={el.y - half}
                    width={half * 2}
                    height={half * 2}
                    rx={6}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth={2 / zoom}
                    strokeDasharray={`${5 / zoom} ${4 / zoom}`}
                  />
                )}
              </g>
            );
          }
          return (
            <g key={el.id}>
              {el.id === selectedElementId && (
                <path
                  d={pointsToSvgPath(el.points)}
                  fill="none"
                  stroke="#f97316"
                  strokeOpacity={0.35}
                  strokeWidth={el.width + 10 / zoom}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <path
                d={pointsToSvgPath(el.points)}
                fill="none"
                stroke={el.color || "#b45309"}
                strokeWidth={el.width}
                strokeDasharray="6 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
        {activeStroke?.kind === "line" && (
          <path
            d={pointsToSvgPath(activeStroke.points)}
            fill="none"
            stroke="#b45309"
            strokeWidth={activeStroke.width}
            strokeDasharray="6 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <LabelsLayer labels={labels} boxesRef={labelBoxesRef} selectedId={selectedElementId} zoom={zoom} />
      </g>
    </svg>
  );
}

/** พรีเซ็ตสีแผ่นดิน/น้ำ + ปุ่มเลือกสีเอง */
function TerrainColorPicker({
  presets,
  value,
  onChange,
}: {
  presets: { key: string; label: string; color: string }[];
  value: string;
  onChange: (color: string) => void;
}) {
  const isCustom = !presets.some((p) => p.color.toLowerCase() === value.toLowerCase());
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((t) => (
        <button
          key={t.key}
          type="button"
          title={t.label}
          aria-label={t.label}
          onClick={() => onChange(t.color)}
          className={cn("h-6 w-6 rounded-full transition hover:scale-110", value.toLowerCase() === t.color.toLowerCase() && "ring-2 ring-primary-500 ring-offset-1")}
          style={{ background: t.color }}
        />
      ))}
      <span className={cn("rounded-full", isCustom && "ring-2 ring-primary-500 ring-offset-1")}>
        <ColorInputSwatch value={value} title="เลือกสีเอง" onChange={onChange} />
      </span>
    </div>
  );
}

function StampColorPicker({ value, onChange }: { value: string | null; onChange: (color: string | null) => void }) {
  return (
    <div className="flex items-center gap-1">
      {STAMP_COLORS.map((c) => (
        <button
          key={c.label}
          type="button"
          title={c.color ? `สี${c.label}` : "สีเดิมของภาพ"}
          aria-label={c.color ? `สี${c.label}` : "สีเดิมของภาพ"}
          onClick={() => onChange(c.color)}
          className={cn(
            "h-5 w-5 rounded-full border border-neutral-300 transition hover:scale-110",
            value === c.color && "ring-2 ring-primary-500 ring-offset-1"
          )}
          style={{ background: c.color ?? "conic-gradient(#57534e 0 25%, #fff 0 50%, #57534e 0 75%, #fff 0)" }}
        />
      ))}
    </div>
  );
}

/** แถบแก้สแตมป์ที่เลือก — ลอยอยู่เหนือสแตมป์ เลื่อนตามการ pan/zoom ของแคนวาส */
function StampToolbar({
  stamp,
  onChange,
  onDelete,
  onClose,
}: {
  stamp: StampElement;
  onChange: (patch: { scale?: number; rotation?: number; color?: string | null }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { x, y, zoom } = useViewport();
  const scale = stamp.scale ?? 1;
  const half = (stampBaseSize(getStampAsset(stamp.icon)) * scale) / 2;
  const btn = "flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 disabled:opacity-40";
  return (
    <div
      className="nodrag nopan nowheel absolute flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
      style={{ left: stamp.x * zoom + x, top: (stamp.y - half) * zoom + y - 10, zIndex: 55 }}
    >
      <button type="button" className={btn} title="ย่อ" disabled={scale <= STAMP_MIN_SCALE} onClick={() => onChange({ scale: clampStampScale(scale - 0.2) })}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-8 text-center text-[11px] text-neutral-500">{scale.toFixed(1)}x</span>
      <button type="button" className={btn} title="ขยาย" disabled={scale >= STAMP_MAX_SCALE} onClick={() => onChange({ scale: clampStampScale(scale + 0.2) })}>
        <Plus className="h-4 w-4" />
      </button>
      <button type="button" className={btn} title="หมุนซ้าย" onClick={() => onChange({ rotation: (stamp.rotation ?? 0) - 15 })}>
        <RotateCcw className="h-4 w-4" />
      </button>
      <button type="button" className={btn} title="หมุนขวา" onClick={() => onChange({ rotation: (stamp.rotation ?? 0) + 15 })}>
        <RotateCw className="h-4 w-4" />
      </button>
      <span className="mx-0.5 h-5 w-px bg-neutral-200" />
      <StampColorPicker value={stamp.color ?? null} onChange={(color) => onChange({ color })} />
      <span className="mx-0.5 h-5 w-px bg-neutral-200" />
      <button type="button" className={cn(btn, "text-red-500 hover:bg-red-50")} title="ลบสแตมป์" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </button>
      <button type="button" className={btn} title="ปิด" onClick={onClose}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** แถบเครื่องมือของเส้นวาดมือที่เลือก — ลอยเหนือจุดที่คลิกบนเส้น */
function LineToolbar({ anchor, onDelete, onClose }: { anchor: { x: number; y: number }; onDelete: () => void; onClose: () => void }) {
  const { x, y, zoom } = useViewport();
  return (
    <div
      className="nodrag nopan nowheel absolute flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
      style={{ left: anchor.x * zoom + x, top: anchor.y * zoom + y - 12, zIndex: 55 }}
    >
      <button
        type="button"
        className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-red-500 hover:bg-red-50"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" /> ลบเส้นนี้
      </button>
      <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100" title="ปิด" onClick={onClose}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** แผนที่จักรวาลของเรื่อง — @xyflow/react ผูกกับ locations จริง พอร์ตแนวคิดมาจาก buddybook_demo/
 *  tool_map และขยายเพิ่ม: แปรงระบายภูมิประเทศ, แปรงปั๊มสิ่งกีดขวางต่อเนื่อง, ย่อ/หมุน/พลิก/จัดเลเยอร์
 *  ไอคอน, หมุดผูกฐานข้อมูล (lore link), ประวัติเวอร์ชันแผนที่ และส่งออกเป็นรูปภาพ
 *  ดู wf_map_dm.png (แท็บ Base) — ไม่มีในสคีมาเดิม พอร์ต/ต่อยอดจากฟีดแบ็กผู้ใช้ทั้งหมด
 *  หมายเหตุ — เคยมีตัวเลือกฟอนต์ป้ายชื่อ (แฟนตาซี/ไซไฟ) แต่ถอดออกแล้ว เพราะฟอนต์เหล่านั้นไม่มี
 *  ตัวอักษรไทย จึงไม่มีผลกับป้ายชื่อภาษาไทยที่ใช้จริงในระบบนี้ */
function WorldMapInner({ novelId, initialLocations, initialEdges, initialDrawings, chapters }: WorldMapProps) {
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow();
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const locationMetaRef = useRef<Map<string, { description: string; linkedChapterId: string | null }>>(
    new Map(initialLocations.map((l) => [l.location_id, { description: l.description ?? "", linkedChapterId: l.linked_chapter_id ?? null }]))
  );

  const renameLocation = useCallback((id: string, name: string) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, name } } : n)));
    fetch(`/api/v1/locations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transformLocation = useCallback((id: string, patch: { scale?: number; rotation?: number; flip_x?: boolean }) => {
    let body: Record<string, unknown> = patch;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        const next = {
          ...n,
          data: {
            ...n.data,
            ...(patch.scale !== undefined ? { scale: patch.scale } : {}),
            ...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
            ...(patch.flip_x !== undefined ? { flipX: patch.flip_x } : {}),
          },
        };
        if (patch.scale === undefined) return next;
        // ย่อ/ขยาย: ปรับขนาดโหนดตามไอคอน และเลื่อนตำแหน่งให้จุดกึ่งกลางไอคอนอยู่ที่เดิม
        // (position คือมุมซ้ายบนของโหนด ถ้าไม่เลื่อน ไอคอนจะโตไปทางขวา-ล่าง)
        const prev = locationNodeSize(n.data.scale ?? 1);
        const nextSize = locationNodeSize(patch.scale);
        const position = {
          x: n.position.x + (prev.width - nextSize.width) / 2,
          y: n.position.y + (prev.iconBox - nextSize.iconBox) / 2,
        };
        body = { ...patch, pos_x: position.x, pos_y: position.y };
        return { ...next, position, ...locationNodeLayout(patch.scale) };
      })
    );
    fetch(`/api/v1/locations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layerOrderLocation = useCallback((id: string, direction: "front" | "back") => {
    setNodes((nds) => {
      const zIndexes = nds.map((n) => n.zIndex ?? 0);
      const nextZ = direction === "front" ? Math.max(0, ...zIndexes) + 1 : Math.min(0, ...zIndexes) - 1;
      fetch(`/api/v1/locations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ z_index: nextZ }),
      }).catch(() => {});
      return nds.map((n) => (n.id === id ? { ...n, zIndex: nextZ } : n));
    });
  }, []);

  const [loreLocationId, setLoreLocationId] = useState<string | null>(null);
  const openLore = useCallback((id: string) => setLoreLocationId(id), []);

  const callbacksRef = useRef({ onRename: renameLocation, onTransform: transformLocation, onLayerOrder: layerOrderLocation, onOpenLore: openLore, onDelete: requestDeleteLocation });
  callbacksRef.current = { onRename: renameLocation, onTransform: transformLocation, onLayerOrder: layerOrderLocation, onOpenLore: openLore, onDelete: requestDeleteLocation };

  const [nodes, setNodes] = useNodesState(
    initialLocations.filter(isPlaced).map((l) => toFlowNode(l, l.pos_x as number, l.pos_y as number, callbacksRef.current))
  );
  const [tray, setTray] = useState<LocationRecord[]>(initialLocations.filter((l) => !isPlaced(l)));
  const [edges, setEdges] = useEdgesState(initialEdges);
  const [placeCount, setPlaceCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDeleteEdgeId, setConfirmDeleteEdgeId] = useState<string | null>(null);
  // ปุ่มถังขยะในแถบเครื่องมือของสถานที่ — เดิมลบได้แค่กด Backspace ซึ่งผู้ใช้ไม่รู้
  const [confirmDeleteLocationId, setConfirmDeleteLocationId] = useState<string | null>(null);

  // โหมดเครื่องมือ: จัดการ / วาดเส้นอิสระ / ระบายภูมิประเทศ (Land Tool) / ปั๊มสิ่งกีดขวาง
  // "pieces" = คลังชิ้นส่วนแผนที่ + ตั้งชื่อพื้นที่ (เลือก/ลาก/แก้วัตถุได้เหมือนโหมดจัดการ)
  const [mode, setModeState] = useState<"manage" | "pieces" | "line" | "fill" | "stamp">("manage");
  function setMode(next: "manage" | "pieces" | "line" | "fill" | "stamp") {
    setModeState(next);
    setSelectedElementId(null);
  }
  const selectMode = mode === "manage" || mode === "pieces";
  const [lineWidth, setLineWidth] = useState(3);
  const [terrainColor, setTerrainColor] = useState(LAND_PRESETS[0].color);
  const [waterColor, setWaterColor] = useState(WATER_PRESETS[0].color);
  // แปรง = ระบายตามเส้นที่ลาก / วาดรูปร่าง = ลากเส้นรอบรูปแล้วเติมเต็มด้านใน (กำหนดขอบเขตแผ่นดิน/ทะเลสาบ)
  const [landShape, setLandShape] = useState<"brush" | "lasso">("brush");
  const [stampIcon, setStampIcon] = useState<StampIconKey>(STAMP_OPTIONS[0].key);
  // ขนาด/สีของสแตมป์ที่จะวางใหม่ — สแตมป์ที่วางแล้วแก้ทีละอันได้โดยคลิกเลือกในโหมด "จัดการ"
  const [stampScale, setStampScale] = useState(1);
  const [stampColor, setStampColor] = useState<string | null>(null);
  // สแตมป์หรือเส้นวาดมือที่เลือกอยู่ (โหมด "จัดการ") + จุดที่คลิกเส้น ใช้วางแถบเครื่องมือของเส้น
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [lineToolbarAnchor, setLineToolbarAnchor] = useState<{ x: number; y: number } | null>(null);
  // Land Tool — เพิ่มภายหลัง (audit fix) ปรับโหมด "fill" เดิม (ลากปิดรูปทรงตรง ๆ) ให้เป็นแปรงเพิ่ม/
  // ลบพื้นที่ดินแบบ Inkarnate แต่ตัดฟีเจอร์ freeform raster masking ออกเพื่อไม่ให้เว็บหนัก (ดูรายละเอียด
  // ที่คุยกับผู้ใช้แล้ว) — ข้อมูลเก่า kind="fill" ยังเรนเดอร์ได้ปกติ แค่ stroke ใหม่ทั้งหมดเป็น kind="land"
  // แผ่นดิน (add) / น้ำ (water) / ยางลบ (subtract) — ดูโมเดลข้อมูลใน MapTerrain.tsx
  const [landActionMode, setLandActionMode] = useState<LandMode>("add");
  const [brushSize, setBrushSize] = useState(40);
  const [roughness, setRoughness] = useState(0);
  const [smoothLand, setSmoothLand] = useState(true);
  // แปลงข้อมูลเก่าครั้งเดียวตอนโหลด (บันทึกจริงเมื่อมีการแก้แผนที่ครั้งถัดไป) — ดู migrateLegacySea
  const [loadedDrawings] = useState(() => initialDrawings.map(migrateLegacySea));
  const [elements, setElements] = useState<MapElement[]>(loadedDrawings);
  // เพิ่มภายหลัง (audit fix) — ปุ่มย้อนกลับ/ทำซ้ำ (Undo/Redo) แบบ Inkarnate ครอบคลุมเฉพาะองค์ประกอบ
  // ที่วาดอิสระ (เส้น/Land Tool/สแตมป์/ล้างทั้งหมด) เก็บ history เป็น index-pointer เข้า snapshot
  // ทั้งชุด ไม่รวมการย้าย/เปลี่ยนชื่อหมุดสถานที่ (ผูกกับ DB จริงแยกต่างหากอยู่แล้วผ่าน renameLocation/
  // transformLocation) — ใช้ ref เก็บค่าล่าสุดกันปัญหา closure ค้างตอนวาดสแตมป์ต่อเนื่องเร็ว ๆ
  const elementsRef = useRef(elements);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);
  const [history, setHistory] = useState<{ stack: MapElement[][]; index: number }>({ stack: [loadedDrawings], index: 0 });
  const [activeStroke, setActiveStroke] = useState<ActiveStroke | null>(null);
  // เลื่อน/ซูมแผนที่ระหว่างอยู่ในโหมดวาด (ชั้นรับการวาดบังตัวแคนวาส จึงต้องจัดการเอง)
  const overlayRef = useRef<HTMLDivElement>(null);
  const brushCursorRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; vx: number; vy: number; zoom: number } | null>(null);
  const spaceHeldRef = useRef(false);
  const recolorTimerRef = useRef<number | undefined>(undefined);
  // ขนาดจริงของชื่อพื้นที่แต่ละอัน วัดจาก DOM หลังเรนเดอร์ (LabelsLayer) — ใช้หาว่าคลิกโดนชื่อไหน
  const labelBoxesRef = useRef<Map<string, LabelBox>>(new Map());
  const lastStampPosRef = useRef<{ x: number; y: number } | null>(null);
  const isStampingRef = useRef(false);

  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<{ version_id: string; created_at: string }[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [exporting, setExporting] = useState(false);

  // บันทึกอัตโนมัติแบบเข้าคิว: ส่งทีละคำขอ และส่งเฉพาะสถานะล่าสุดที่ค้างอยู่ — เดิมยิง PATCH ซ้อนกัน
  // ได้หลายคำขอ ถ้าคำขอเก่าไปถึงเซิร์ฟเวอร์ทีหลังจะเขียนทับของใหม่ และบันทึกไม่ผ่านก็เงียบไปเลย
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const pendingSaveRef = useRef<MapElement[] | null>(null);
  const saveInFlightRef = useRef<Promise<void> | null>(null);

  function saveElements(next: MapElement[]) {
    pendingSaveRef.current = next;
    if (!saveInFlightRef.current) saveInFlightRef.current = flushSaves();
  }

  async function flushSaves() {
    setSaveState("saving");
    let ok = true;
    while (pendingSaveRef.current) {
      const body = pendingSaveRef.current;
      pendingSaveRef.current = null;
      try {
        const res = await fetch(`/api/v1/novels/${novelId}/map-drawings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        ok = res.ok;
        if (!res.ok) console.error("บันทึกแผนที่ไม่สำเร็จ", res.status, await res.json().catch(() => null));
      } catch {
        ok = false;
      }
    }
    saveInFlightRef.current = null;
    setSaveState(ok ? "saved" : "error");
  }

  /** รอให้การบันทึกที่ค้างอยู่ทั้งหมดเสร็จ (รวมที่หน่วงเวลาไว้ตอนพิมพ์ชื่อ/เลือกสี) */
  async function flushPendingSaves() {
    if (recolorTimerRef.current !== undefined) {
      window.clearTimeout(recolorTimerRef.current);
      recolorTimerRef.current = undefined;
      saveElements(elementsRef.current);
      pushHistory(elementsRef.current);
    }
    while (saveInFlightRef.current) await saveInFlightRef.current;
  }

  // บันทึก snapshot ลง history — เรียกครั้งเดียวต่อ "การกระทำ" หนึ่งครั้ง (ปล่อยเมาส์/ล้างทั้งหมด)
  // ไม่ใช่ทุกจุดระหว่างลาก ไม่งั้นลากหนึ่งเส้นจะกลายเป็น undo step เป็นร้อย ๆ ครั้ง
  function pushHistory(snapshot: MapElement[]) {
    setHistory((h) => {
      const truncated = h.stack.slice(0, h.index + 1);
      return { stack: [...truncated, snapshot], index: truncated.length };
    });
  }

  function commitElements(next: MapElement[]) {
    setElements(next);
    saveElements(next);
    pushHistory(next);
  }

  function undo() {
    setHistory((h) => {
      if (h.index <= 0) return h;
      const newIndex = h.index - 1;
      const snapshot = h.stack[newIndex];
      setElements(snapshot);
      saveElements(snapshot);
      return { ...h, index: newIndex };
    });
  }

  function redo() {
    setHistory((h) => {
      if (h.index >= h.stack.length - 1) return h;
      const newIndex = h.index + 1;
      const snapshot = h.stack[newIndex];
      setElements(snapshot);
      saveElements(snapshot);
      return { ...h, index: newIndex };
    });
  }

  const canUndo = history.index > 0;
  const canRedo = history.index < history.stack.length - 1;

  // คีย์ลัด Ctrl/Cmd+Z (ย้อนกลับ) และ Ctrl/Cmd+Shift+Z หรือ Ctrl/Cmd+Y (ทำซ้ำ) — ข้ามถ้ากำลังพิมพ์
  // อยู่ในช่องข้อความอื่นของหน้า (เช่น เปลี่ยนชื่อสถานที่/เนื้อหาเรื่องราวใน LoreModal)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<LocationNodeData>>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      for (const change of changes) {
        if (change.type === "remove") {
          fetch(`/api/v1/locations/${change.id}`, { method: "DELETE" }).catch(() => {});
        }
      }
    },
    [setNodes]
  );

  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    fetch(`/api/v1/locations/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pos_x: node.position.x, pos_y: node.position.y }),
    }).catch(() => {});
  }, []);

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      for (const change of changes) {
        if (change.type === "remove") {
          fetch(`/api/v1/location-edges/${change.id}`, { method: "DELETE" }).catch(() => {});
        }
      }
    },
    [setEdges]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      try {
        const res = await fetch(`/api/v1/novels/${novelId}/location-edges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_location_id: connection.source,
            target_location_id: connection.target,
            // บันทึกจุดต่อเส้น (บน/ขวา/ล่าง/ซ้าย) รีเฟรชแล้วเส้นทางอยู่ตำแหน่งเดิม
            source_handle: connection.sourceHandle ?? undefined,
            target_handle: connection.targetHandle ?? undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) return;
        setEdges((eds) => addEdge({ ...connection, id: json.edge_id, style: { stroke: "#b45309", strokeDasharray: "6 5" } }, eds));
      } catch {
        // สร้างเส้นทางไม่สำเร็จ — ไม่เพิ่มเส้นใน canvas
      }
    },
    [novelId, setEdges]
  );

  // เพิ่มภายหลัง — ลากปลายเส้นทางที่มีอยู่ไปต่อจุดใหม่/สถานที่ใหม่ได้เลย ไม่ต้องลบแล้วลากใหม่
  // (shouldReplaceId: false = คง id เดิมไว้ เพราะ id คือ edge_id ใน DB)
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target || newConnection.source === newConnection.target) return;
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds, { shouldReplaceId: false }));
      fetch(`/api/v1/location-edges/${oldEdge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_location_id: newConnection.source,
          target_location_id: newConnection.target,
          source_handle: newConnection.sourceHandle ?? null,
          target_handle: newConnection.targetHandle ?? null,
        }),
      })
        .then(async (res) => {
          if (res.ok) return;
          // บันทึกไม่ผ่าน — ย้อนเส้นกลับตำแหน่งเดิม ไม่ให้หน้าจอกับฐานข้อมูลไม่ตรงกัน + บอกสาเหตุ
          setEdges((eds) => eds.map((e) => (e.id === oldEdge.id ? oldEdge : e)));
          const json = await res.json().catch(() => null);
          console.error("ย้ายเส้นไม่สำเร็จ", res.status, json);
          toast(formatApiError(json, "ย้ายเส้นไม่สำเร็จ ลองใหม่อีกครั้ง"));
        })
        .catch(() => setEdges((eds) => eds.map((e) => (e.id === oldEdge.id ? oldEdge : e))));
    },
    [setEdges]
  );

  const onEdgeClick = useCallback((_event: unknown, edge: Edge) => {
    setConfirmDeleteEdgeId(edge.id);
  }, []);

  function deleteEdgeFromPopup() {
    if (!confirmDeleteEdgeId) return;
    const id = confirmDeleteEdgeId;
    setEdges((eds) => eds.filter((e) => e.id !== id));
    setConfirmDeleteEdgeId(null);
    fetch(`/api/v1/location-edges/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function requestDeleteLocation(id: string) {
    setConfirmDeleteLocationId(id);
  }

  function deleteLocationFromPopup() {
    if (!confirmDeleteLocationId) return;
    const id = confirmDeleteLocationId;
    setNodes((nds) => nds.filter((n) => n.id !== id));
    // backend (deleteLocation) ลบเส้นทางที่ต่อกับสถานที่นี้ทิ้งด้วย (ไม่ได้ย้ายลงถังขยะ) — เอาออกจากแคนวาสด้วย
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setConfirmDeleteLocationId(null);
    fetch(`/api/v1/locations/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function addLocation({ name, icon, category }: { name: string; icon: LocationIconKey; category?: string }) {
    const res = await fetch(`/api/v1/novels/${novelId}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, map_icon_url: icon, category }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatApiError(json, "เพิ่มสถานที่ไม่สำเร็จ ลองใหม่อีกครั้ง"));
    locationMetaRef.current.set(json.location_id, { description: "", linkedChapterId: null });
    setTray((t) => [...t, { location_id: json.location_id, name, icon, category, pos_x: null, pos_y: null }]);
  }

  async function placeLocation(location: LocationRecord) {
    const col = placeCount % 4;
    const row = Math.floor(placeCount / 4);
    const position = { x: 60 + col * 150, y: 60 + row * 140 };
    setPlaceCount((n) => n + 1);
    setTray((t) => t.filter((l) => l.location_id !== location.location_id));
    setNodes((nds) => [...nds, toFlowNode(location, position.x, position.y, callbacksRef.current)]);
    fetch(`/api/v1/locations/${location.location_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pos_x: position.x, pos_y: position.y }),
    }).catch(() => {});
  }

  function newStampStyle(): { scale?: number; color?: string } {
    return { ...(stampScale !== 1 ? { scale: stampScale } : {}), ...(stampColor ? { color: stampColor } : {}) };
  }

  // สแตมป์อยู่ในเลเยอร์ SVG ที่ไม่รับ pointer event (อยู่ใต้แคนวาส) จึงคลิกโดนตรง ๆ ไม่ได้ — หาเองจาก
  // จุดที่คลิกบนพื้นแผนที่ ไล่จากอันที่วางทีหลังสุด (อยู่บนสุด) ก่อน
  function findStampAt(pos: { x: number; y: number }): StampElement | null {
    const list = elementsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const el = list[i];
      if (el.kind !== "stamp") continue;
      const half = Math.max(12, (stampBaseSize(getStampAsset(el.icon)) * (el.scale ?? 1)) / 2);
      if (Math.abs(pos.x - el.x) <= half && Math.abs(pos.y - el.y) <= half) return el;
    }
    return null;
  }

  // เส้นวาดมือ (เช่น เส้นประเส้นทาง) — คลิกห่างจากเส้นไม่เกินครึ่งความหนา + 6px ก็นับว่าโดน
  function findLineAt(pos: { x: number; y: number }): LineElement | null {
    const list = elementsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const el = list[i];
      if (!isLineElement(el)) continue;
      const tolerance = el.width / 2 + 6;
      if (el.points.length === 1 && distance(el.points[0], pos) <= tolerance) return el;
      for (let j = 0; j < el.points.length - 1; j++) {
        if (distanceToSegment(pos, el.points[j], el.points[j + 1]) <= tolerance) return el;
      }
    }
    return null;
  }

  function findLabelAt(pos: { x: number; y: number }): MapLabel | null {
    const list = elementsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const el = list[i];
      if (el.kind === "label" && hitLabel(el, labelBoxesRef.current.get(el.id), pos)) return el;
    }
    return null;
  }

  function findPieceAt(pos: { x: number; y: number }): MapPiece | null {
    const list = elementsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const el = list[i];
      if (el.kind === "piece" && hitPiece(el, pos)) return el;
    }
    return null;
  }

  // ลำดับการเลือก = ลำดับที่มองเห็นจากบนลงล่าง: ชื่อพื้นที่ → สแตมป์ → เส้น → ชิ้นส่วนแผนที่
  function handlePaneClick(e: React.MouseEvent) {
    if (!selectMode) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const label = findLabelAt(pos);
    const stamp = label ? null : findStampAt(pos);
    const line = label || stamp ? null : findLineAt(pos);
    const piece = label || stamp || line ? null : findPieceAt(pos);
    setSelectedElementId(label?.id ?? stamp?.id ?? line?.id ?? piece?.id ?? null);
    setLineToolbarAnchor(line ? pos : null);
  }

  function deleteElement(id: string) {
    // ลบชิ้นส่วน: ชื่อที่ผูกอยู่ยังคงอยู่ แค่เลิกผูก
    commitElements(
      elementsRef.current
        .filter((el) => el.id !== id)
        .map((el) => (el.kind === "label" && el.attachTo === id ? { ...el, attachTo: undefined } : el))
    );
    setSelectedElementId(null);
  }

  // ---------- ชิ้นส่วนแผนที่ / ชื่อพื้นที่ ----------

  function newId(prefix: string) {
    return `${prefix}-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
  }

  /** จุดกึ่งกลางของพื้นที่แผนที่ที่มองเห็นอยู่ (พิกัดแผนที่) */
  function viewCenter(): { x: number; y: number } {
    const rect = canvasWrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  function addPiece(key: string, at?: { x: number; y: number }) {
    if (!getPieceDef(key)) return;
    const pos = at ?? viewCenter();
    const piece: MapPiece = { id: newId("piece"), kind: "piece", piece: key, x: Math.round(pos.x), y: Math.round(pos.y), scale: 1, rotation: 0 };
    commitElements([...elementsRef.current, piece]);
    setSelectedElementId(piece.id);
  }

  function handleCanvasDrop(e: React.DragEvent) {
    const key = e.dataTransfer.getData(PIECE_DRAG_MIME);
    if (!key) return;
    e.preventDefault();
    if (!selectMode) setModeState("pieces");
    addPiece(key, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }

  function addLabel(category: LabelCategory, attachTo?: MapPiece) {
    const cat = LABEL_CATEGORIES.find((c) => c.key === category) ?? LABEL_CATEGORIES[0];
    const pos = attachTo ? { x: attachTo.x, y: attachTo.y } : viewCenter();
    const label: MapLabel = {
      id: newId("label"),
      kind: "label",
      text: `ชื่อ${cat.label}`,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      category: cat.key,
      ...cat.preset,
      ...(attachTo ? { attachTo: attachTo.id } : {}),
    };
    commitElements([...elementsRef.current, label]);
    setSelectedElementId(label.id);
  }

  /** ชิ้นส่วนเปลี่ยนตำแหน่ง/ขนาด/มุม/พลิก → ย้ายชื่อที่ผูกอยู่ให้อยู่ตำแหน่งเดิมบนชิ้นนั้น */
  function withAttachedLabels(list: MapElement[], before: MapPiece, after: MapPiece, labelSnapshot?: Map<string, MapLabel>): MapElement[] {
    return list.map((el) => {
      if (el.kind === "piece" && el.id === after.id) return after;
      if (el.kind !== "label" || el.attachTo !== after.id) return el;
      const from = labelSnapshot?.get(el.id) ?? el;
      const local = toPieceLocal(before, from);
      const pos = fromPieceLocal(after, local);
      return { ...el, x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10 };
    });
  }

  /** แก้คุณสมบัติวัตถุ — debounce = รอหยุดพิมพ์/เลือกสีก่อนค่อยบันทึกและเก็บ undo */
  function patchElement(id: string, patch: Record<string, unknown>, debounce = false) {
    const current = elementsRef.current.find((el) => el.id === id);
    if (!current) return;
    // ผู้ใช้แก้เองแล้ว = ไม่ใช่ของที่ระบบสุ่มอีกต่อไป (การสุ่มเฉพาะบางประเภทครั้งหน้าจะไม่ลบทิ้ง)
    const updated = { ...current, ...patch, gen: undefined } as MapElement;
    for (const k of [...Object.keys(patch), "gen"]) if ((updated as Record<string, unknown>)[k] === undefined) delete (updated as Record<string, unknown>)[k];
    const next =
      current.kind === "piece"
        ? withAttachedLabels(elementsRef.current, current, updated as MapPiece)
        : elementsRef.current.map((el) => (el.id === id ? updated : el));
    if (!debounce) {
      window.clearTimeout(recolorTimerRef.current);
      commitElements(next);
      return;
    }
    elementsRef.current = next;
    setElements(next);
    window.clearTimeout(recolorTimerRef.current);
    recolorTimerRef.current = window.setTimeout(() => {
      saveElements(elementsRef.current);
      pushHistory(elementsRef.current);
    }, 600);
  }

  function moveLayer(id: string, dir: "front" | "back") {
    const list = elementsRef.current;
    const el = list.find((e) => e.id === id);
    if (!el) return;
    const rest = list.filter((e) => e.id !== id);
    if (dir === "front") {
      commitElements([...rest, el]);
    } else {
      // หลังสุด = ถัดจากพื้นหลัง (พื้นหลังต้องอยู่ล่างสุดเสมอ)
      const bases = rest.filter((e) => e.kind === "base");
      commitElements([...bases, el, ...rest.filter((e) => e.kind !== "base")]);
    }
  }

  function duplicateElement(id: string) {
    const el = elementsRef.current.find((e) => e.id === id);
    if (!el || (el.kind !== "piece" && el.kind !== "label" && el.kind !== "stamp")) return;
    const copy = { ...el, id: newId(el.kind), x: el.x + 40, y: el.y + 40 } as MapElement;
    if (copy.kind === "label") delete copy.attachTo;
    commitElements([...elementsRef.current, copy]);
    setSelectedElementId(copy.id);
  }

  // กรอบแปลงรูป: เก็บสถานะตอนเริ่มลาก แล้วคำนวณจากจุดเริ่มทุกครั้ง (ไม่สะสมความคลาดเคลื่อน)
  const gizmoStartRef = useRef<{ el: MapElement; labels: Map<string, MapLabel> } | null>(null);

  function gizmoStart(id: string) {
    const el = elementsRef.current.find((e) => e.id === id);
    if (!el) return;
    const labels = new Map<string, MapLabel>();
    for (const e of elementsRef.current) if (e.kind === "label" && e.attachTo === id) labels.set(e.id, e);
    gizmoStartRef.current = { el, labels };
  }

  function gizmoPreview(patch: GizmoPatch) {
    const start = gizmoStartRef.current;
    if (!start) return;
    const s = start.el;
    let next: MapElement[];
    if (s.kind === "piece") {
      let after: MapPiece = s;
      if ("dx" in patch) after = { ...s, x: Math.round(s.x + patch.dx), y: Math.round(s.y + patch.dy) };
      else if ("factor" in patch) after = { ...s, scale: Math.min(PIECE_MAX_SCALE, Math.max(PIECE_MIN_SCALE, Math.round((s.scale ?? 1) * patch.factor * 100) / 100)) };
      else after = { ...s, rotation: patch.rotation };
      next = withAttachedLabels(elementsRef.current, s, after, start.labels);
    } else if (s.kind === "label") {
      let after: MapLabel = s;
      if ("dx" in patch) after = { ...s, x: Math.round(s.x + patch.dx), y: Math.round(s.y + patch.dy) };
      else if ("factor" in patch) after = { ...s, size: Math.min(120, Math.max(8, Math.round(s.size * patch.factor))) };
      else after = { ...s, rotation: patch.rotation };
      next = elementsRef.current.map((el) => (el.id === s.id ? after : el));
    } else if (s.kind === "stamp") {
      let after: StampElement = s;
      if ("dx" in patch) after = { ...s, x: Math.round(s.x + patch.dx), y: Math.round(s.y + patch.dy) };
      else if ("factor" in patch) after = { ...s, scale: clampStampScale((s.scale ?? 1) * patch.factor) };
      next = elementsRef.current.map((el) => (el.id === s.id ? after : el));
    } else {
      return;
    }
    elementsRef.current = next;
    setElements(next);
  }

  function gizmoEnd(changed: boolean) {
    const id = gizmoStartRef.current?.el.id;
    gizmoStartRef.current = null;
    if (!changed) return;
    commitElements(elementsRef.current.map((el) => (el.id === id && "gen" in el && el.gen ? (({ gen: _gen, ...rest }) => rest as MapElement)(el) : el)));
  }

  // ---------- สุ่มแผนที่ ----------

  const [showGenerator, setShowGenerator] = useState(false);
  const [showExport, setShowExport] = useState(false);

  function isLandish(el: MapElement): boolean {
    if (el.kind === "land") return el.mode === "add";
    if (el.kind !== "piece") return false;
    const cat = getPieceDef(el.piece)?.category;
    return cat === "land" || cat === "coast";
  }

  function isTerrainPiece(el: MapElement): boolean {
    return el.kind === "piece" && getPieceDef(el.piece)?.category === "terrain";
  }

  function insertAfterLast(list: MapElement[], match: (el: MapElement) => boolean, items: MapElement[]): MapElement[] {
    if (items.length === 0) return list;
    let idx = -1;
    list.forEach((el, i) => {
      if (match(el)) idx = i;
    });
    if (idx === -1) idx = list.findIndex((el) => el.kind !== "base") - 1;
    if (idx < -1) idx = list.length - 1;
    return [...list.slice(0, idx + 1), ...items, ...list.slice(idx + 1)];
  }

  function runGenerator(settings: GenSettings, kinds: Set<GenKind>, replaceAll: boolean, moveLocations: boolean) {
    let kept = replaceAll
      ? elementsRef.current.filter((el) => el.kind === "base")
      : elementsRef.current.filter((el) => !("gen" in el && el.gen && kinds.has(el.gen)));
    // สุ่มทั้งแผนที่แต่ยังไม่มีพื้นมหาสมุทร — ใส่ให้ แผนที่ที่ได้จะดูเป็นโลกแฟนตาซีทันที
    if (replaceAll && !(kept.find((el) => el.kind === "base") as MapBase | undefined)?.color) {
      kept = [{ ...DEFAULT_BASE, color: "#5fa8d3" }, ...kept.filter((el) => el.kind !== "base")];
    }
    const result = generateMap(settings, kinds, {
      existingTerrain: kept.filter((el): el is TerrainItem => el.kind === "land" || el.kind === "piece"),
      existingLandPieces: kept.filter((el): el is MapPiece => el.kind === "piece" && isLandish(el)),
      center: viewCenter(),
      locationCount: moveLocations ? nodes.length + tray.length : 0,
      namedPieceIds: new Set(kept.flatMap((el) => (el.kind === "label" && el.attachTo && !el.gen ? [el.attachTo] : []))),
    });
    const cast = (items: GenElement[]) => items as unknown as MapElement[];
    const bases = kept.filter((el) => el.kind === "base");
    let next: MapElement[] = [...bases, ...cast(result.byKind.land), ...kept.filter((el) => el.kind !== "base")];
    next = insertAfterLast(next, isLandish, cast(result.byKind.terrain));
    next = insertAfterLast(next, (el) => isLandish(el) || isTerrainPiece(el), cast(result.byKind.water));
    next = [...next, ...cast(result.byKind.settlements), ...cast(result.byKind.labels)];
    commitElements(next);
    setSelectedElementId(null);
    if (moveLocations && result.locationSpots.length > 0) relocateLocations(result.locationSpots);
    const added = Object.values(result.byKind).reduce((n, list) => n + list.length, 0);
    toast(added > 0 ? `สุ่มแผนที่แล้ว (รหัส ${settings.seed})` : "ไม่มีพื้นที่ให้สุ่ม — ลองสุ่มแผ่นดินด้วย");
    if (kinds.has("land")) {
      window.requestAnimationFrame(() => {
        const b = contentBounds(next);
        const rect = canvasWrapperRef.current?.getBoundingClientRect();
        if (b && rect) fitToBounds(b, rect.width, rect.height, 0.1);
      });
    }
  }

  /** ย้ายหมุดสถานที่ (ทั้งที่วางแล้วและที่รอวาง) ไปยังจุดสุ่มบนแผ่นดิน */
  function relocateLocations(spots: { x: number; y: number }[]) {
    let i = 0;
    const patches: { id: string; x: number; y: number }[] = [];
    const posFor = (scale: number, spot: { x: number; y: number }) => {
      const size = locationNodeSize(scale);
      return { x: Math.round(spot.x - size.width / 2), y: Math.round(spot.y - size.iconBox / 2) };
    };
    const moved = nodes.map((n) => {
      const spot = spots[i];
      if (!spot) return n;
      i += 1;
      const position = posFor(n.data.scale ?? 1, spot);
      patches.push({ id: n.id, ...position });
      return { ...n, position };
    });
    const placedFromTray: Node<LocationNodeData>[] = [];
    const stillWaiting: LocationRecord[] = [];
    for (const loc of tray) {
      const spot = spots[i];
      if (!spot) {
        stillWaiting.push(loc);
        continue;
      }
      i += 1;
      const position = posFor(loc.scale ?? 1, spot);
      patches.push({ id: loc.location_id, ...position });
      placedFromTray.push(toFlowNode(loc, position.x, position.y, callbacksRef.current));
    }
    setNodes([...moved, ...placedFromTray]);
    setTray(stillWaiting);
    for (const pt of patches) {
      fetch(`/api/v1/locations/${pt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pos_x: pt.x, pos_y: pt.y }),
      }).catch(() => {});
    }
  }

  /** ขอบเขตของทุกอย่างบนแผนที่ (พิกัดแผนที่) — ใช้ซูมให้เห็นทั้งแผนที่และตอนส่งออกรูป */
  function contentBounds(list: MapElement[] = elementsRef.current): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const add = (x: number, y: number, r = 0) => {
      x0 = Math.min(x0, x - r);
      y0 = Math.min(y0, y - r);
      x1 = Math.max(x1, x + r);
      y1 = Math.max(y1, y + r);
    };
    for (const el of list) {
      if (el.kind === "piece") {
        const def = getPieceDef(el.piece);
        if (!def) continue;
        const b = def.bounds;
        for (const c of [
          { x: b.minX, y: b.minY },
          { x: b.maxX, y: b.minY },
          { x: b.minX, y: b.maxY },
          { x: b.maxX, y: b.maxY },
        ]) {
          const pt = fromPieceLocal(el, c);
          add(pt.x, pt.y, 12);
        }
      } else if (el.kind === "land") {
        for (const pt of el.points) add(pt.x, pt.y, el.closed ? 12 : el.brushSize);
      } else if (el.kind === "stamp") {
        add(el.x, el.y, 30 * (el.scale ?? 1));
      } else if (el.kind === "label") {
        const b = labelBoxesRef.current.get(el.id) ?? estimateLabelBox(el);
        add(b.x, b.y);
        add(b.x + b.w, b.y + b.h);
      } else if (el.kind === "fill" || el.kind === undefined || el.kind === "line") {
        for (const pt of el.points) add(pt.x, pt.y, 6);
      }
    }
    for (const n of nodes) {
      const size = locationNodeSize(n.data.scale ?? 1);
      add(n.position.x, n.position.y);
      add(n.position.x + size.width, n.position.y + size.height);
    }
    if (!Number.isFinite(x0)) return null;
    return { x0, y0, x1, y1 };
  }

  function fitToBounds(b: { x0: number; y0: number; x1: number; y1: number }, width: number, height: number, padRatio = 0.06) {
    const bw = Math.max(1, b.x1 - b.x0);
    const bh = Math.max(1, b.y1 - b.y0);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(width / (bw * (1 + padRatio * 2)), height / (bh * (1 + padRatio * 2)))));
    setViewport({ x: width / 2 - ((b.x0 + b.x1) / 2) * zoom, y: height / 2 - ((b.y0 + b.y1) / 2) * zoom, zoom });
  }

  function fitAll() {
    const b = contentBounds();
    const rect = canvasWrapperRef.current?.getBoundingClientRect();
    if (b && rect) fitToBounds(b, rect.width, rect.height, 0.1);
  }

  // ---------- เต็มจอ ----------

  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen().catch(() => toast("เบราว์เซอร์นี้ไม่รองรับโหมดเต็มจอ"));
  }

  // ซูมด้วยล้อเมาส์ตรงตำแหน่งเคอร์เซอร์ (ใช้ทั้งชั้นรับการวาดและกรอบแปลงรูป)
  function zoomAtPointer(e: WheelEvent) {
    e.preventDefault();
    const rect = canvasWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vp = getViewport();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * Math.exp(-e.deltaY * 0.0015)));
    const k = nextZoom / vp.zoom;
    setViewport({ x: px - (px - vp.x) * k, y: py - (py - vp.y) * k, zoom: nextZoom });
  }

  function updateStamp(id: string, patch: { scale?: number; rotation?: number; color?: string | null }) {
    commitElements(
      elementsRef.current.map((el) => {
        if (el.id !== id || el.kind !== "stamp") return el;
        const { color, ...rest } = patch;
        const next: StampElement = { ...el, ...rest };
        delete next.gen;
        if (color === null) delete next.color;
        else if (color !== undefined) next.color = color;
        return next;
      })
    );
  }

  const selectedStamp = selectedElementId
    ? ((elements.find((el) => el.id === selectedElementId && el.kind === "stamp") as StampElement | undefined) ?? null)
    : null;
  const selectedLine = selectedElementId ? (elements.find((el) => el.id === selectedElementId && isLineElement(el)) as LineElement | undefined) ?? null : null;
  const selectedPiece = selectedElementId ? ((elements.find((el) => el.id === selectedElementId && el.kind === "piece") as MapPiece | undefined) ?? null) : null;
  const selectedLabel = selectedElementId ? ((elements.find((el) => el.id === selectedElementId && el.kind === "label") as MapLabel | undefined) ?? null) : null;
  const selectedPieceDef = selectedPiece ? getPieceDef(selectedPiece.piece) ?? null : null;
  const labelAttachedPiece = selectedLabel?.attachTo
    ? ((elements.find((el) => el.id === selectedLabel.attachTo && el.kind === "piece") as MapPiece | undefined) ?? null)
    : null;

  // กรอบแปลงรูปของวัตถุที่เลือก (ขอบเขตเทียบกับจุดอ้างอิงของวัตถุ ก่อนหมุน)
  let gizmo: { x: number; y: number; rotation: number; bounds: { minX: number; minY: number; maxX: number; maxY: number }; canRotate: boolean } | null = null;
  if (selectedPiece && selectedPieceDef) {
    const sc = selectedPiece.scale ?? 1;
    const b = selectedPieceDef.bounds;
    gizmo = {
      x: selectedPiece.x,
      y: selectedPiece.y,
      rotation: selectedPiece.rotation ?? 0,
      bounds: selectedPiece.flipX
        ? { minX: -b.maxX * sc, maxX: -b.minX * sc, minY: b.minY * sc, maxY: b.maxY * sc }
        : { minX: b.minX * sc, maxX: b.maxX * sc, minY: b.minY * sc, maxY: b.maxY * sc },
      canRotate: true,
    };
  } else if (selectedLabel) {
    const box = labelBoxesRef.current.get(selectedLabel.id);
    const w = box?.w ?? selectedLabel.text.length * selectedLabel.size * 0.6;
    const h = box?.h ?? selectedLabel.size * 1.3;
    const bx = box ? box.x - selectedLabel.x : -w / 2;
    const by = box ? box.y - selectedLabel.y : -h / 2;
    gizmo = { x: selectedLabel.x, y: selectedLabel.y, rotation: selectedLabel.rotation ?? 0, bounds: { minX: bx - 5, minY: by - 4, maxX: bx + w + 5, maxY: by + h + 4 }, canRotate: true };
  } else if (selectedStamp) {
    const half = (stampBaseSize(getStampAsset(selectedStamp.icon)) * (selectedStamp.scale ?? 1)) / 2 + 4;
    gizmo = { x: selectedStamp.x, y: selectedStamp.y, rotation: 0, bounds: { minX: -half, minY: -half, maxX: half, maxY: half }, canRotate: false };
  }

  const mapBase = (elements.find((el) => el.kind === "base") as MapBase | undefined) ?? DEFAULT_BASE;

  function updateBase(patch: Partial<Pick<MapBase, "color" | "texture">>) {
    const current = (elementsRef.current.find((el) => el.kind === "base") as MapBase | undefined) ?? DEFAULT_BASE;
    const nextBase: MapBase = { ...current, ...patch, id: BASE_ID, kind: "base" };
    commitElements([nextBase, ...elementsRef.current.filter((el) => el.kind !== "base")]);
  }

  // สีที่ใช้บนแผนที่ (แผ่นดิน + น้ำ) เรียงตามลำดับที่ปรากฏ — ใช้กับเครื่องมือเปลี่ยนสีทั้งแผนที่
  const usedTerrainColors: { color: string; water: boolean }[] = [];
  for (const el of elements) {
    if (el.kind !== "land" || el.mode === "subtract") continue;
    const water = el.mode === "water";
    if (!usedTerrainColors.some((c) => c.color.toLowerCase() === el.color.toLowerCase() && c.water === water)) {
      usedTerrainColors.push({ color: el.color, water });
    }
  }

  // เปลี่ยนสีพื้นที่ที่วาดไว้แล้วทั้งหมดที่ใช้สี from — อัปเดตจอทันที แต่บันทึก/เก็บ undo หลังหยุดเลือกสี
  // 0.5 วิ (color picker ยิง event ถี่มากตอนลากเลือกสี)
  function recolorTerrain(from: string, water: boolean, to: string) {
    const next = elementsRef.current.map((el) =>
      el.kind === "land" && el.mode !== "subtract" && (el.mode === "water") === water && el.color.toLowerCase() === from.toLowerCase()
        ? { ...el, color: to }
        : el
    );
    elementsRef.current = next;
    setElements(next);
    window.clearTimeout(recolorTimerRef.current);
    recolorTimerRef.current = window.setTimeout(() => {
      saveElements(elementsRef.current);
      pushHistory(elementsRef.current);
    }, 500);
  }

  const zoomAtPointerRef = useRef(zoomAtPointer);
  zoomAtPointerRef.current = zoomAtPointer;

  // ปุ่ม Delete = ลบวัตถุบนแผนที่ที่เลือกอยู่ (ชิ้นส่วน/ชื่อ/สแตมป์/เส้น) — ไม่ใช้ Backspace เพราะ
  // React Flow ใช้ลบหมุดสถานที่อยู่แล้ว
  const deleteSelectedRef = useRef<() => void>(() => {});
  deleteSelectedRef.current = () => {
    if (selectedElementId && selectMode) deleteElement(selectedElementId);
  };
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.tagName === "SELECT" || t?.isContentEditable) return;
      if (e.key === "Delete") deleteSelectedRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ซูมด้วยล้อเมาส์ตรงตำแหน่งเคอร์เซอร์ระหว่างอยู่ในโหมดวาด — ต้องเป็น listener แบบ passive: false
  // (onWheel ของ React เป็น passive เรียก preventDefault ไม่ได้ หน้าเว็บจะเลื่อนตามไปด้วย)
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => zoomAtPointerRef.current(e);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mode]);

  // กด Space ค้างไว้ = เลื่อนแผนที่ด้วยการลาก (เหมือนโปรแกรมวาดภาพทั่วไป)
  useEffect(() => {
    if (mode === "manage" || mode === "pieces") return;
    function isTyping(target: EventTarget | null) {
      const t = target as HTMLElement | null;
      return t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || isTyping(e.target)) return;
      e.preventDefault();
      spaceHeldRef.current = true;
      if (overlayRef.current) overlayRef.current.style.cursor = "grab";
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      spaceHeldRef.current = false;
      if (overlayRef.current) overlayRef.current.style.cursor = "";
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      spaceHeldRef.current = false;
    };
  }, [mode]);

  // วงกลมแสดงขนาดหัวแปรง — ขยับผ่าน style ตรง ๆ ไม่ผ่าน state กันทั้งหน้า re-render ทุกครั้งที่ขยับเมาส์
  function moveBrushCursor(e: React.PointerEvent | null) {
    const cursor = brushCursorRef.current;
    if (!cursor) return;
    if (!e) {
      cursor.style.display = "none";
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const d = brushSize * 2 * getViewport().zoom;
    cursor.style.display = "block";
    cursor.style.width = `${d}px`;
    cursor.style.height = `${d}px`;
    cursor.style.transform = `translate(${e.clientX - rect.left - d / 2}px, ${e.clientY - rect.top - d / 2}px)`;
  }

  function handlePointerDown(e: React.PointerEvent) {
    // ปุ่มกลาง/ปุ่มขวา หรือกด Space ค้าง = เลื่อนแผนที่ (ไม่วาด)
    if (e.button === 1 || e.button === 2 || spaceHeldRef.current) {
      const vp = getViewport();
      panRef.current = { startX: e.clientX, startY: e.clientY, vx: vp.x, vy: vp.y, zoom: vp.zoom };
      e.currentTarget.setPointerCapture(e.pointerId);
      (e.currentTarget as HTMLElement).style.cursor = "grabbing";
      return;
    }
    if (e.button !== 0) return;
    if (mode === "line") {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setActiveStroke({ kind: "line", points: [pos], width: lineWidth });
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (mode === "fill") {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setActiveStroke({
        kind: "land",
        points: [pos],
        color: landActionMode === "water" ? waterColor : terrainColor,
        brushSize,
        landMode: landActionMode,
        closed: landShape === "lasso",
      });
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (mode === "stamp") {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      isStampingRef.current = true;
      lastStampPosRef.current = pos;
      const el: MapElement = { id: `stamp-${Date.now()}`, kind: "stamp", icon: stampIcon, x: pos.x, y: pos.y, ...newStampStyle() };
      setElements((prev) => {
        const next = [...prev, el];
        saveElements(next);
        return next;
      });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // หมายเหตุ: โหมดสแตมป์ไม่เรียก pushHistory ที่นี่ — รอไปรวมเป็น 1 undo step ตอนปล่อยเมาส์ใน
    // handlePointerUp กันลากปั๊มต่อเนื่องยาว ๆ กลายเป็น undo step เป็นสิบ ๆ ครั้ง
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (panRef.current) {
      const pan = panRef.current;
      setViewport({ x: pan.vx + e.clientX - pan.startX, y: pan.vy + e.clientY - pan.startY, zoom: pan.zoom });
      return;
    }
    if (mode === "fill" && landShape === "brush") moveBrushCursor(e);
    if ((mode === "line" || mode === "fill") && activeStroke) {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setActiveStroke((prev) => (prev ? { ...prev, points: [...prev.points, pos] } : null));
    } else if (mode === "stamp" && isStampingRef.current) {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (!lastStampPosRef.current || distance(lastStampPosRef.current, pos) >= MIN_STAMP_SPACING * stampScale) {
        lastStampPosRef.current = pos;
        const el: MapElement = { id: newId("stamp"), kind: "stamp", icon: stampIcon, x: pos.x, y: pos.y, ...newStampStyle() };
        setElements((prev) => {
          const next = [...prev, el];
          saveElements(next);
          return next;
        });
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (panRef.current) {
      panRef.current = null;
      (e.currentTarget as HTMLElement).style.cursor = spaceHeldRef.current ? "grab" : "";
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    if ((mode === "line" || mode === "fill") && activeStroke) {
      let el: MapElement;
      if (activeStroke.kind === "land" && activeStroke.closed && activeStroke.points.length < 3) {
        // วาดรูปร่างแต่ลากสั้นเกินไปจนไม่เป็นรูป — ไม่บันทึก
        setActiveStroke(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
        return;
      }
      if (activeStroke.kind === "land") {
        // ปรับความขรุขระ/ความเรียบครั้งเดียวตอนปล่อยเมาส์เท่านั้น (ไม่ใช่ทุก frame ตอนลาก) กันเว็บหนัก
        let finalPoints = thinPoints(activeStroke.points, activeStroke.closed ? 4 : Math.max(2, activeStroke.brushSize * 0.15));
        if (roughness > 0) finalPoints = jitterPoints(finalPoints, roughness);
        if (smoothLand) finalPoints = smoothPoints(finalPoints);
        finalPoints = capPoints(finalPoints);
        el = {
          id: `land-${Date.now()}`,
          kind: "land",
          points: finalPoints,
          brushSize: activeStroke.brushSize,
          mode: activeStroke.landMode,
          color: activeStroke.color,
          ...(activeStroke.closed ? { closed: true } : {}),
        };
      } else {
        el = { id: `line-${Date.now()}`, kind: "line", points: capPoints(activeStroke.points), width: activeStroke.width };
      }
      commitElements([...elementsRef.current, el]);
      setActiveStroke(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
    } else if (mode === "stamp") {
      isStampingRef.current = false;
      lastStampPosRef.current = null;
      // ปั๊มระหว่างลากทั้งหมดรวมเป็น undo step เดียว ณ จุดนี้ (แต่ละไอคอนเซฟลง backend ไปแล้วทีละอัน
      // ตอนวาง กันข้อมูลหายถ้าเบราว์เซอร์ปิดกลางคัน — pushHistory แค่บันทึก snapshot ไม่ยิง save ซ้ำ)
      pushHistory(elementsRef.current);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function clearElements() {
    // คงพื้นหลัง/การตั้งค่าแผนที่ไว้ ลบเฉพาะสิ่งที่วาด
    commitElements(elementsRef.current.filter((el) => el.kind === "base"));
  }

  async function saveLore(input: { lore: string; chapterId: string | null }) {
    if (!loreLocationId) return;
    await fetch(`/api/v1/locations/${loreLocationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: input.lore, linked_chapter_id: input.chapterId }),
    });
    locationMetaRef.current.set(loreLocationId, { description: input.lore, linkedChapterId: input.chapterId });
  }

  async function openVersionsPanel() {
    setShowVersions(true);
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/v1/novels/${novelId}/map-versions`);
      const json = await res.json();
      if (res.ok) setVersions(json.versions ?? []);
    } finally {
      setLoadingVersions(false);
    }
  }

  async function saveVersion() {
    setSavingVersion(true);
    try {
      // snapshot ฝั่งเซิร์ฟเวอร์อ่านจากฐานข้อมูล — ต้องรอการบันทึกอัตโนมัติที่ค้างอยู่ให้เสร็จก่อน
      // ไม่งั้นเวอร์ชันที่บันทึกอาจขาดสิ่งที่เพิ่งแก้
      await flushPendingSaves();
      const res = await fetch(`/api/v1/novels/${novelId}/map-versions`, { method: "POST" });
      toast(res.ok ? "บันทึกเวอร์ชันแผนที่แล้ว" : "บันทึกเวอร์ชันไม่สำเร็จ ลองใหม่อีกครั้ง");
    } catch {
      toast("บันทึกเวอร์ชันไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSavingVersion(false);
    }
  }

  async function restoreVersion(versionId: string) {
    await fetch(`/api/v1/map-versions/${versionId}/restore`, { method: "POST" });
    window.location.reload();
  }

  /** ส่งออกรูปภาพความละเอียดสูง — "ทั้งแผนที่" จะซูมแคนวาสให้เห็นทุกอย่างก่อน แล้วเรนเดอร์ด้วย pixelRatio
   *  สูง (ภาพเวกเตอร์ถูกวาดใหม่ที่ความละเอียดนั้น ไม่ใช่การขยายภาพจากจอ) และครอปเหลือเฉพาะขอบเขตแผนที่
   *  (ไม่เปลี่ยนขนาดกรอบแคนวาสชั่วคราว — เคยลองแล้ว React Flow วัดขนาดใหม่ไม่ทันก่อนถ่ายภาพ ได้ภาพว่าง) */
  async function exportAsImage({ scope, size, format }: { scope: ExportScope; size: number; format: ExportFormat }) {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;
    setExporting(true);
    setSelectedElementId(null);
    setLineToolbarAnchor(null);
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)));
    const prevViewport = getViewport();
    try {
      const { toCanvas } = await import("html-to-image");
      const cssW = wrapper.clientWidth;
      const cssH = wrapper.clientHeight;
      let crop = { x: 0, y: 0, w: cssW, h: cssH };
      const bounds = scope === "all" ? contentBounds() : null;
      if (bounds) {
        fitToBounds(bounds, cssW, cssH, 0.04);
        const vp = getViewport();
        const pad = 12;
        const x0 = Math.max(0, bounds.x0 * vp.zoom + vp.x - pad);
        const y0 = Math.max(0, bounds.y0 * vp.zoom + vp.y - pad);
        const x1 = Math.min(cssW, bounds.x1 * vp.zoom + vp.x + pad);
        const y1 = Math.min(cssH, bounds.y1 * vp.zoom + vp.y + pad);
        crop = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
      }
      // รอให้แคนวาส/ฟิลเตอร์เรนเดอร์ตามมุมมองใหม่ และให้ปุ่ม/กรอบเลือกหายไปก่อนถ่ายภาพ
      await new Promise((r) => setTimeout(r, 500));
      const pixelRatio = Math.min(12, size / Math.max(crop.w, crop.h));
      const background = mapBase.color ?? "#fafaf9";
      const full = await toCanvas(wrapper, {
        pixelRatio,
        backgroundColor: background,
        cacheBust: true,
        style: { border: "none", borderRadius: "0" },
        // ไม่เอาปุ่มซูม จุดกริดพื้นหลัง และเครื่องมือแก้ไขติดไปในรูป
        filter: (node: HTMLElement) =>
          !(node instanceof Element) ||
          !(node.classList.contains("react-flow__controls") || node.classList.contains("react-flow__background") || node.hasAttribute("data-export-ignore")),
      });
      const out = document.createElement("canvas");
      out.width = Math.round(crop.w * pixelRatio);
      out.height = Math.round(crop.h * pixelRatio);
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context unavailable");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(full, crop.x * pixelRatio, crop.y * pixelRatio, out.width, out.height, 0, 0, out.width, out.height);
      const dataUrl = format === "jpeg" ? out.toDataURL("image/jpeg", 0.92) : out.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `map-${novelId}.${format === "jpeg" ? "jpg" : "png"}`;
      link.href = dataUrl;
      link.click();
      toast("ส่งออกรูปภาพแผนที่แล้ว");
      setShowExport(false);
    } catch (err) {
      console.error("ส่งออกรูปภาพไม่สำเร็จ", err);
      toast("ส่งออกรูปภาพไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setViewport(prevViewport);
      setExporting(false);
    }
  }

  const loreLocation = loreLocationId
    ? { id: loreLocationId, name: nodes.find((n) => n.id === loreLocationId)?.data.name as string | undefined, meta: locationMetaRef.current.get(loreLocationId) }
    : null;

  const modeInstructions: Record<typeof mode, string> = {
    manage:
      "คลิกสแตมป์บนแผนที่เพื่อปรับขนาด/สี/หมุน/ลบ — คลิกเส้นที่วาดเองเพื่อลบทีละเส้น — ลากสถานที่เพื่อจัดตำแหน่ง หรือลากจากจุดกลมรอบไอคอน (บน/ขวา/ล่าง/ซ้าย) ไปยังอีกสถานที่เพื่อสร้างเส้นทาง — ดับเบิลคลิกชื่อเพื่อแก้ไข — เลือกไอคอนเพื่อย่อ/หมุน/พลิก/จัดเลเยอร์/เปิดเนื้อหาเรื่องราว — กดที่เส้นทางเพื่อลบ",
    pieces:
      "ลากชิ้นส่วนจากคลังลงแผนที่ (หรือกดเพื่อวางกลางจอ) — คลิกชิ้นส่วน/ชื่อเพื่อเลือก: ลากในกรอบ = ย้าย, มุมขวาล่าง = ย่อ/ขยาย, ปุ่มกลมด้านบน = หมุน — วางชิ้นซ้อนกันเพื่อต่อเป็นแผ่นดินผืนใหญ่ — ปุ่ม Delete = ลบ",
    line: 'ลากเมาส์บนแผนที่เพื่อวาดเส้นอิสระ เช่น ชายฝั่งหรือเขตแดน — กด "จัดการ" เพื่อกลับไปแก้ไขสถานที่',
    fill: 'เลือก "แผ่นดิน" / "น้ำ" / "ยางลบ" แล้วลากเพื่อระบาย หรือเลือก "วาดรูปร่าง" แล้วลากรอบรูปเพื่อเติมทั้งพื้นที่ (เกาะ ทวีป ทะเลสาบ) — ล้อเมาส์ = ซูม, ลากด้วยปุ่มขวา/ปุ่มกลาง หรือกด Space ค้าง = เลื่อนแผนที่',
    stamp: 'เลือกไอคอน ขนาด และสีด้านบน แล้วคลิกหรือลากบนแผนที่เพื่อวางต่อเนื่อง เช่น แนวเทือกเขาหรือแนวต้นไม้ — สแตมป์ที่วางแล้วแก้ได้ในโหมด "จัดการ" (คลิกที่สแตมป์)',
  };

  return (
    <div ref={rootRef} className={cn(isFullscreen && "flex h-full flex-col overflow-auto bg-white p-4")}>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-800">สถานที่ที่รอวาง</p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-pill border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-primary-400 hover:text-primary-500"
          >
            <MapPinned className="h-4 w-4" />
            เพิ่มสถานที่
          </button>
        </div>
        <div className="flex min-h-[5.5rem] flex-wrap items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
          {tray.length === 0 ? (
            <p className="mx-auto text-xs text-neutral-400">
              ยังไม่มีสถานที่รอวาง — กด &quot;เพิ่มสถานที่&quot; แล้วกดที่สถานที่เพื่อวางลงบนแผนที่ด้านล่าง
            </p>
          ) : (
            tray.map((l) => {
              const asset = getLocationAsset(l.icon);
              return (
                <button
                  key={l.location_id}
                  type="button"
                  onClick={() => placeLocation(l)}
                  title={`กดเพื่อวาง ${l.name} บนแผนที่`}
                  className="flex w-20 flex-col items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-white"
                >
                  <div className={cn("flex h-12 w-12 items-center justify-center", !asset?.src && "rounded-2xl bg-brand-tan/30")}>
                    <MapAssetIcon asset={asset} size={asset?.src ? 48 : 24} className="text-brand-tan-dark" />
                  </div>
                  <span className="max-w-full truncate text-xs text-neutral-600">{l.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-neutral-800">แผนที่</p>
          {saveState === "saving" && <span className="text-xs text-neutral-400">กำลังบันทึก...</span>}
          {saveState === "saved" && <span className="text-xs text-emerald-600">บันทึกอัตโนมัติแล้ว</span>}
          {saveState === "error" && (
            <button type="button" onClick={() => saveElements(elementsRef.current)} className="text-xs font-medium text-red-500 underline">
              บันทึกไม่สำเร็จ — กดเพื่อลองใหม่
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="ย้อนกลับ (Ctrl+Z)"
              aria-label="ย้อนกลับ"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 hover:border-primary-400 hover:text-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="ทำซ้ำ (Ctrl+Shift+Z)"
              aria-label="ทำซ้ำ"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 hover:border-primary-400 hover:text-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowGenerator((v) => !v);
              setShowExport(false);
            }}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium",
              showGenerator ? "border-primary-500 bg-primary-500 text-white" : "border-primary-300 text-primary-600 hover:bg-primary-50"
            )}
          >
            <Dices className="h-3.5 w-3.5" /> สุ่มแผนที่
          </button>
          <button type="button" onClick={saveVersion} disabled={savingVersion} className="flex h-8 items-center gap-1.5 rounded-pill border border-neutral-300 px-3 text-xs font-medium text-neutral-600 hover:border-primary-400 hover:text-primary-500 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> บันทึกเวอร์ชัน
          </button>
          <button type="button" onClick={openVersionsPanel} className="flex h-8 items-center gap-1.5 rounded-pill border border-neutral-300 px-3 text-xs font-medium text-neutral-600 hover:border-primary-400 hover:text-primary-500">
            <History className="h-3.5 w-3.5" /> ประวัติเวอร์ชัน
          </button>
          <button
            type="button"
            onClick={() => {
              setShowExport((v) => !v);
              setShowGenerator(false);
            }}
            disabled={exporting}
            className="flex h-8 items-center gap-1.5 rounded-pill border border-neutral-300 px-3 text-xs font-medium text-neutral-600 hover:border-primary-400 hover:text-primary-500 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> {exporting ? "กำลังส่งออก..." : "ส่งออกรูปภาพ"}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "ออกจากโหมดเต็มจอ" : "แก้ไขแผนที่แบบเต็มจอ"}
            aria-label={isFullscreen ? "ออกจากโหมดเต็มจอ" : "เต็มจอ"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 hover:border-primary-400 hover:text-primary-500"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {showGenerator && (
        <div className="mb-3">
          <RandomMapPanel
            hasContent={elements.some((el) => el.kind !== "base")}
            locationCount={nodes.length + tray.length}
            onGenerate={runGenerator}
            onClose={() => setShowGenerator(false)}
          />
        </div>
      )}
      {showExport && (
        <div className="mb-3">
          <ExportPanel exporting={exporting} onExport={exportAsImage} onClose={() => setShowExport(false)} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-0.5 rounded-2xl bg-neutral-100 p-0.5">
          <button type="button" onClick={() => setMode("manage")} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "manage" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}>
            <Hand className="h-3.5 w-3.5" /> จัดการ
          </button>
          <button type="button" onClick={() => setMode("pieces")} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "pieces" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}>
            <Puzzle className="h-3.5 w-3.5" /> ชิ้นส่วนแผนที่
          </button>
          <button type="button" onClick={() => setMode("line")} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "line" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}>
            <Pencil className="h-3.5 w-3.5" /> วาดเส้น
          </button>
          <button type="button" onClick={() => setMode("fill")} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "fill" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}>
            <PaintBucket className="h-3.5 w-3.5" /> ภูมิประเทศ
          </button>
          <button type="button" onClick={() => setMode("stamp")} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "stamp" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}>
            <Stamp className="h-3.5 w-3.5" /> ปั๊มสิ่งกีดขวาง
          </button>
        </div>

        {mode === "line" && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
              ขนาดเส้น
              <input type="range" min={1} max={10} value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="accent-primary-500" />
              <span className="w-4 text-neutral-600">{lineWidth}</span>
            </label>
          </div>
        )}

        {mode === "pieces" && <PiecesLibrary onAddPiece={(key) => addPiece(key)} onAddLabel={(cat) => addLabel(cat)} />}

        {selectMode && selectedPiece && selectedPieceDef && (
          <PiecePropertiesBar
            piece={selectedPiece}
            def={selectedPieceDef}
            onChange={(patch) => patchElement(selectedPiece.id, patch)}
            onLayer={(dir) => moveLayer(selectedPiece.id, dir)}
            onDuplicate={() => duplicateElement(selectedPiece.id)}
            onDelete={() => deleteElement(selectedPiece.id)}
            onClose={() => setSelectedElementId(null)}
            onAddLabel={() => addLabel(selectedPieceDef.category === "water" ? "region" : "country", selectedPiece)}
          />
        )}

        {selectMode && selectedLabel && (
          <LabelPropertiesBar
            label={selectedLabel}
            attachedName={labelAttachedPiece ? getPieceDef(labelAttachedPiece.piece)?.label ?? "ชิ้นส่วน" : null}
            onChange={(patch) => patchElement(selectedLabel.id, patch)}
            onTextChange={(text) => patchElement(selectedLabel.id, { text }, true)}
            onLayer={(dir) => moveLayer(selectedLabel.id, dir)}
            onDuplicate={() => duplicateElement(selectedLabel.id)}
            onDelete={() => deleteElement(selectedLabel.id)}
            onClose={() => setSelectedElementId(null)}
          />
        )}

        {mode === "fill" && (
          <div className="w-full space-y-2 rounded-lg border border-neutral-200 bg-white p-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-full bg-neutral-100 p-0.5">
                {(
                  [
                    { key: "add", label: "แผ่นดิน" },
                    { key: "water", label: "น้ำ" },
                    { key: "subtract", label: "ยางลบ" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setLandActionMode(t.key)}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium transition", landActionMode === t.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center rounded-full bg-neutral-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setLandShape("brush")}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition", landShape === "brush" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}
                >
                  แปรง
                </button>
                <button
                  type="button"
                  onClick={() => setLandShape("lasso")}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition", landShape === "lasso" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}
                >
                  วาดรูปร่าง
                </button>
              </div>

              {landActionMode !== "subtract" && (
                <TerrainColorPicker
                  presets={landActionMode === "water" ? WATER_PRESETS : LAND_PRESETS}
                  value={landActionMode === "water" ? waterColor : terrainColor}
                  onChange={landActionMode === "water" ? setWaterColor : setTerrainColor}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {landShape === "brush" && (
                <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                  ขนาดแปรง
                  <input type="range" min={5} max={200} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="accent-primary-500" />
                  <span className="w-7 text-neutral-600">{brushSize}</span>
                </label>
              )}

              <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                ความขรุขระ
                <input type="range" min={0} max={20} value={roughness} onChange={(e) => setRoughness(Number(e.target.value))} className="accent-primary-500" />
                <span className="w-6 text-neutral-600">{roughness}</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={smoothLand}
                  onChange={(e) => setSmoothLand(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-400"
                />
                ขอบเรียบ
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                พื้นหลัง/มหาสมุทร
                {BASE_PRESETS.map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    title={b.label}
                    aria-label={b.label}
                    onClick={() => updateBase({ color: b.color })}
                    className={cn(
                      "h-5 w-5 rounded-full border border-neutral-300 transition hover:scale-110",
                      (mapBase.color ?? null) === b.color && "ring-2 ring-primary-500 ring-offset-1"
                    )}
                    style={{ background: b.color ?? "repeating-linear-gradient(45deg, #fff 0 3px, #e5e7eb 3px 6px)" }}
                  />
                ))}
                <ColorInputSwatch
                  value={mapBase.color ?? "#5fa8d3"}
                  title="เลือกสีพื้นหลังเอง"
                  onChange={(color) => updateBase({ color })}
                />
              </div>

              <label className="flex items-center gap-1.5 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={mapBase.texture !== false}
                  onChange={(e) => updateBase({ texture: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-400"
                />
                พื้นผิวแฟนตาซี (ขอบชายฝั่ง/ลายพื้นผิว)
              </label>

              {usedTerrainColors.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                  เปลี่ยนสีพื้นที่ที่วาดแล้ว
                  {usedTerrainColors.map((c, i) => (
                    <ColorInputSwatch
                      key={`${c.water ? "w" : "l"}-${i}`}
                      value={c.color}
                      title={`${c.water ? "น้ำ" : "แผ่นดิน"} — คลิกเพื่อเปลี่ยนสีทุกพื้นที่ที่ใช้สีนี้`}
                      onChange={(to) => recolorTerrain(c.color, c.water, to)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {mode === "stamp" && (
          <div className="flex flex-wrap items-center gap-1.5">
            {STAMP_OPTIONS.map((s) => {
              return (
                <button
                  key={s.key}
                  type="button"
                  title={s.label}
                  onClick={() => setStampIcon(s.key)}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", stampIcon === s.key ? "border-primary-500 bg-primary-50" : "border-neutral-300 hover:bg-neutral-50")}
                >
                  <MapAssetIcon asset={s} size={s.src ? 26 : 16} className="text-neutral-600" />
                </button>
              );
            })}
            <label className="ml-2 flex items-center gap-1.5 text-xs text-neutral-500">
              ขนาด
              <input
                type="range"
                min={STAMP_MIN_SCALE}
                max={STAMP_MAX_SCALE}
                step={0.1}
                value={stampScale}
                onChange={(e) => setStampScale(clampStampScale(Number(e.target.value)))}
                className="accent-primary-500"
              />
              <span className="w-7 text-neutral-600">{stampScale.toFixed(1)}x</span>
            </label>
            <StampColorPicker value={stampColor} onChange={setStampColor} />
          </div>
        )}

        {!selectMode && elements.length > 0 && (
          <button type="button" onClick={clearElements} className="text-xs text-red-500 underline">
            ล้างองค์ประกอบที่วาด
          </button>
        )}
      </div>

      <div
        ref={canvasWrapperRef}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(PIECE_DRAG_MIME)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={handleCanvasDrop}
        className={cn(
          "relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50",
          isFullscreen ? "min-h-[24rem] flex-1" : "h-[28rem] md:h-[34rem]"
        )}
      >
        {/* ฟิลเตอร์เส้นภาพสเก็ตช์ต้องอยู่ในกรอบแคนวาส — ตอนส่งออกรูปจะคัดลอกเฉพาะส่วนนี้ */}
        <MapInkFilterDefs />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onReconnect={onReconnect}
          edgesReconnectable
          onEdgeClick={onEdgeClick}
          onPaneClick={handlePaneClick}
          onNodeClick={() => setSelectedElementId(null)}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          panOnDrag={selectMode}
          nodesDraggable={selectMode}
          fitView
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          proOptions={{ hideAttribution: true }}
        >
          <DrawingLayer elements={elements} activeStroke={activeStroke} selectedElementId={selectedElementId} labelBoxesRef={labelBoxesRef} />
          {selectMode && gizmo && selectedElementId && (
            <TransformGizmo
              key={selectedElementId}
              x={gizmo.x}
              y={gizmo.y}
              rotation={gizmo.rotation}
              bounds={gizmo.bounds}
              canRotate={gizmo.canRotate}
              onStart={() => gizmoStart(selectedElementId)}
              onPreview={gizmoPreview}
              onEnd={gizmoEnd}
              onWheelZoom={zoomAtPointer}
            />
          )}
          {selectMode && selectedStamp && (
            <StampToolbar
              stamp={selectedStamp}
              onChange={(patch) => updateStamp(selectedStamp.id, patch)}
              onDelete={() => deleteElement(selectedStamp.id)}
              onClose={() => setSelectedElementId(null)}
            />
          )}
          {selectMode && selectedLine && lineToolbarAnchor && (
            <LineToolbar
              anchor={lineToolbarAnchor}
              onDelete={() => deleteElement(selectedLine.id)}
              onClose={() => setSelectedElementId(null)}
            />
          )}
          <Background gap={16} color="#e5e7eb" />
          {/* ชั้นรับการวาด (โหมดวาดเส้น/ระบาย/ปั๊ม) — อยู่ใน <ReactFlow> ร่วมกับ Controls เพื่อให้จัด
              ลำดับซ้อนกันได้: เดิมอยู่นอก <ReactFlow> แล้วคลุมทับปุ่มซูม (+ / − / เต็มจอ) จนกดไม่ได้ */}
          {!selectMode && (
            <div
              ref={overlayRef}
              className="absolute inset-0 touch-none overflow-hidden"
              style={{ zIndex: 50, cursor: mode === "stamp" ? "copy" : mode === "fill" && landShape === "brush" ? "none" : "crosshair" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={() => moveBrushCursor(null)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {mode === "fill" && landShape === "brush" && (
                <div
                  ref={brushCursorRef}
                  className="pointer-events-none absolute left-0 top-0 hidden rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
                />
              )}
            </div>
          )}
          <Controls showInteractive={false} showFitView={false} style={{ zIndex: 60 }}>
            {/* ปุ่ม fitView เดิมของ React Flow ดูแค่หมุดสถานที่ — แทนด้วยปุ่มที่ดูทั้งแผนที่ (ภูมิประเทศ/ชิ้นส่วน/ชื่อ) */}
            <ControlButton onClick={fitAll} title="ดูทั้งแผนที่" aria-label="ดูทั้งแผนที่">
              <Maximize2 />
            </ControlButton>
          </Controls>
        </ReactFlow>
      </div>

      <p className="mt-3 text-center text-xs text-neutral-400">{modeInstructions[mode]}</p>

      {showAddModal && <AddLocationModal onClose={() => setShowAddModal(false)} onSubmit={addLocation} />}

      {loreLocation && (
        <LoreModal
          novelId={novelId}
          locationName={loreLocation.name ?? ""}
          initialLore={loreLocation.meta?.description ?? ""}
          initialChapterId={loreLocation.meta?.linkedChapterId ?? null}
          chapters={chapters}
          onClose={() => setLoreLocationId(null)}
          onSave={saveLore}
        />
      )}

      {confirmDeleteEdgeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xs rounded-card bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-h3 text-neutral-900">ลบเส้นทางนี้?</h2>
              <button type="button" onClick={() => setConfirmDeleteEdgeId(null)} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-neutral-500">เส้นทางที่ลบจะย้ายไปที่ถังขยะ กู้คืนได้ภายหลัง</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmDeleteEdgeId(null)}>
                ยกเลิก
              </Button>
              <button type="button" onClick={deleteEdgeFromPopup} className="flex h-10 items-center gap-1.5 rounded-pill bg-red-500 px-5 text-sm font-medium text-white hover:bg-red-600">
                <Trash2 className="h-4 w-4" /> ลบเส้นทาง
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteLocationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xs rounded-card bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-h3 text-neutral-900">
                ลบ &quot;{nodes.find((n) => n.id === confirmDeleteLocationId)?.data.name ?? "สถานที่นี้"}&quot;?
              </h2>
              <button type="button" onClick={() => setConfirmDeleteLocationId(null)} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-neutral-500">สถานที่จะย้ายไปที่ถังขยะ กู้คืนได้ภายหลัง แต่เส้นทางที่เชื่อมกับสถานที่นี้จะถูกลบถาวร</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmDeleteLocationId(null)}>
                ยกเลิก
              </Button>
              <button type="button" onClick={deleteLocationFromPopup} className="flex h-10 items-center gap-1.5 rounded-pill bg-red-500 px-5 text-sm font-medium text-white hover:bg-red-600">
                <Trash2 className="h-4 w-4" /> ลบสถานที่
              </button>
            </div>
          </div>
        </div>
      )}

      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-h3 text-neutral-900">ประวัติเวอร์ชันแผนที่</h2>
              <button type="button" onClick={() => setShowVersions(false)} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {loadingVersions ? (
              <p className="py-6 text-center text-sm text-neutral-400">กำลังโหลด...</p>
            ) : versions.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">ยังไม่มีเวอร์ชันที่บันทึกไว้ — กด &quot;บันทึกเวอร์ชัน&quot; ก่อน</p>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {versions.map((v) => (
                  <li key={v.version_id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                    <span className="text-neutral-600">{new Date(v.created_at).toLocaleString("th-TH", { timeZone: THAI_TIME_ZONE })}</span>
                    <button type="button" onClick={() => restoreVersion(v.version_id)} className="text-xs font-semibold text-primary-500 hover:underline">
                      กู้คืน
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setShowVersions(false)}>
                ปิด
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function WorldMap(props: WorldMapProps) {
  return (
    <ReactFlowProvider>
      <WorldMapInner {...props} />
    </ReactFlowProvider>
  );
}
