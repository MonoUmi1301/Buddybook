"use client";

/** คลังชิ้นส่วนแผนที่สำเร็จรูป (Map Pieces Library)
 *
 *  รูปร่างทั้งหมดสร้างด้วยโค้ด (procedural, seed คงที่ — ได้รูปเดิมทุกครั้ง) ไม่ใช้ไฟล์ภาพภายนอก
 *  จึงไม่มีปัญหาลิขสิทธิ์และไม่เพิ่มขนาดหน้าเว็บ ชิ้นส่วนเรนเดอร์ผ่าน TerrainLayer (MapTerrain.tsx)
 *  ชุดเดียวกับแปรงแผ่นดิน/น้ำ — mask + ฟิลเตอร์ขอบชายฝั่งเดียวกัน ชิ้นที่วางซ้อน/ชิดกันจึงหลอม
 *  เป็นแผ่นดินผืนเดียวโดยอัตโนมัติ (ไม่ต้องบังคับให้ขอบต่อกันพอดีแบบจิ๊กซอว์)
 *  ไอคอนตกแต่ง (ภูเขา/ต้นไม้) ใช้ภาพสแตมป์ที่มีอยู่แล้วใน public/stamps/
 *
 *  key ของชิ้นส่วนถูกบันทึกลงฐานข้อมูล (map_drawings kind "piece") — ห้ามเปลี่ยนชื่อ key เดิม */

import { useMemo } from "react";
import { SvgStamp, getStampAsset, type StampIconKey } from "@/components/writer/mapAssets";
import type { Point } from "@/components/writer/MapTerrain";

export interface MapPiece {
  id: string;
  kind: "piece";
  piece: string;
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  flipX?: boolean;
  /** สีหลักของชิ้น (แผ่นดินหรือน้ำ ตามชนิดชิ้น) — ไม่ระบุ = สีตั้งต้นของชิ้น */
  color?: string;
  /** สร้างโดยระบบสุ่มแผนที่ (ประเภท) — ถูกลบออกเมื่อผู้ใช้แก้ไขเอง ดู mapGenerator.ts */
  gen?: "land" | "terrain" | "water" | "labels" | "settlements";
}

export interface PiecePolygon {
  role: "land" | "water";
  points: Point[];
}

export interface PieceFeature {
  icon: StampIconKey;
  x: number;
  y: number;
  scale: number;
}

export type PieceCategory = "land" | "coast" | "water" | "terrain";

export interface PieceDef {
  key: string;
  label: string;
  category: PieceCategory;
  /** สีที่ใช้ระบายถ้าผู้ใช้ไม่ได้เปลี่ยน */
  color: string;
  /** role ที่ปุ่มเปลี่ยนสีของชิ้นนี้ไปเปลี่ยน */
  primary: "land" | "water";
  polygons: PiecePolygon[];
  features: PieceFeature[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export const PIECE_CATEGORIES: { key: PieceCategory; label: string }[] = [
  { key: "land", label: "เกาะ/แผ่นดิน" },
  { key: "coast", label: "ชายฝั่ง/ช่องแคบ" },
  { key: "water", label: "แหล่งน้ำ" },
  { key: "terrain", label: "ภูมิประเทศ" },
];

const LAND = "#86a05c";
const FOREST = "#5f7f45";
const DESERT = "#e0c16c";
const SNOW = "#e8eef2";
const ROCK = "#a39a8c";
const LAKE = "#7cc4d8";

// ---------- ตัวสร้างรูปร่าง ----------

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function angleDiff(a: number, b: number): number {
  const d = Math.atan2(Math.sin(a - b), Math.cos(a - b));
  return Math.abs(d);
}

interface BlobOpts {
  seed: number;
  rx: number;
  ry: number;
  cx?: number;
  cy?: number;
  wobble?: number;
  /** ส่วนยื่น (amount > 0 = แหลม/คาบสมุทร) หรือส่วนเว้า (amount < 0 = อ่าว) ที่มุม angle (เรเดียน) */
  bumps?: { angle: number; width: number; amount: number }[];
  n?: number;
}

/** รูปทรงก้อนแบบธรรมชาติ: วงรี + คลื่นไซน์หลายความถี่ (สุ่มจาก seed) + ส่วนยื่น/เว้าที่กำหนด */
function blob({ seed, rx, ry, cx = 0, cy = 0, wobble = 0.16, bumps = [], n = 96 }: BlobOpts): Point[] {
  const rand = mulberry32(seed);
  const waves = [2, 3, 4, 5, 7, 9].map((k) => ({ k, phase: rand() * Math.PI * 2, amp: (rand() * wobble) / Math.sqrt(k / 2) }));
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let r = 1;
    for (const w of waves) r += Math.sin(w.k * t + w.phase) * w.amp;
    for (const b of bumps) r += b.amount * Math.exp(-((angleDiff(t, b.angle) / b.width) ** 2));
    r = Math.max(0.15, r);
    pts.push({ x: cx + Math.cos(t) * rx * r, y: cy + Math.sin(t) * ry * r });
  }
  return pts;
}

/** แถบชายฝั่งยาว: ขอบบนเป็นเส้นคลื่น ด้านล่างเป็นแผ่นดินลึกลงไป (ใช้ต่อเป็นแนวชายฝั่ง/อ่าว) */
function coastStrip({ seed, width, depth, bay }: { seed: number; width: number; depth: number; bay?: { at: number; w: number; d: number } }): Point[] {
  const rand = mulberry32(seed);
  const waves = [1, 2, 3, 5, 8].map((k) => ({ k, phase: rand() * Math.PI * 2, amp: (rand() * 14) / Math.sqrt(k) }));
  const top: Point[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = -width / 2 + u * width;
    let y = 0;
    for (const w of waves) y += Math.sin(w.k * u * Math.PI * 2 + w.phase) * w.amp;
    if (bay) y += bay.d * Math.exp(-(((u - bay.at) / bay.w) ** 2));
    top.push({ x, y });
  }
  // ขอบล่างโค้งเล็กน้อยให้ปลายไม่เป็นมุมฉากเวลาวางเดี่ยว ๆ
  return [...top, { x: width / 2, y: depth * 0.7 }, { x: width / 3, y: depth }, { x: -width / 3, y: depth }, { x: -width / 2, y: depth * 0.7 }];
}

function scatter(seed: number, count: number, rx: number, ry: number, icon: StampIconKey, scale: number, cx = 0, cy = 0): PieceFeature[] {
  const rand = mulberry32(seed);
  const out: PieceFeature[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 30) {
    const x = (rand() * 2 - 1) * rx;
    const y = (rand() * 2 - 1) * ry;
    if ((x / rx) ** 2 + (y / ry) ** 2 > 1) continue;
    if (out.some((f) => Math.hypot(f.x - x - cx, f.y - y - cy) < 26 * scale)) continue;
    out.push({ icon, x: x + cx, y: y + cy, scale: scale * (0.85 + rand() * 0.3) });
  }
  // เรียงจากบนลงล่าง ไอคอนด้านล่างจะทับด้านบน ดูมีมิติ
  return out.sort((a, b) => a.y - b.y);
}

function ridge(seed: number, length: number, count: number, scale: number): PieceFeature[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const u = count === 1 ? 0.5 : i / (count - 1);
    return {
      icon: "mountain" as StampIconKey,
      x: -length / 2 + u * length + (rand() - 0.5) * 14,
      y: Math.sin(u * Math.PI * 1.3) * 18 + (rand() - 0.5) * 12,
      scale: scale * (0.8 + rand() * 0.45),
    };
  }).sort((a, b) => a.y - b.y);
}

function boundsOf(polygons: PiecePolygon[], features: PieceFeature[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygons.flatMap((pl) => pl.points)) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  for (const f of features) {
    const half = 20 * f.scale;
    minX = Math.min(minX, f.x - half);
    minY = Math.min(minY, f.y - half);
    maxX = Math.max(maxX, f.x + half);
    maxY = Math.max(maxY, f.y + half);
  }
  return { minX, minY, maxX, maxY };
}

type RawDef = Omit<PieceDef, "bounds">;

function land(points: Point[]): PiecePolygon {
  return { role: "land", points };
}
function water(points: Point[]): PiecePolygon {
  return { role: "water", points };
}

const RAW_PIECES: RawDef[] = [
  // ---- เกาะ/แผ่นดิน ----
  { key: "islet", label: "เกาะเล็ก", category: "land", color: LAND, primary: "land", polygons: [land(blob({ seed: 11, rx: 45, ry: 32 }))], features: [] },
  { key: "island-round", label: "เกาะกลาง", category: "land", color: LAND, primary: "land", polygons: [land(blob({ seed: 21, rx: 95, ry: 70, wobble: 0.2 }))], features: [] },
  {
    key: "island-long",
    label: "เกาะยาว",
    category: "land",
    color: LAND,
    primary: "land",
    polygons: [land(blob({ seed: 33, rx: 170, ry: 55, wobble: 0.18, bumps: [{ angle: 0.4, width: 0.3, amount: 0.25 }] }))],
    features: [],
  },
  {
    key: "island-large",
    label: "เกาะใหญ่",
    category: "land",
    color: LAND,
    primary: "land",
    polygons: [land(blob({ seed: 47, rx: 190, ry: 140, wobble: 0.22, bumps: [{ angle: 2.2, width: 0.35, amount: 0.3 }, { angle: 5.3, width: 0.3, amount: -0.25 }] }))],
    features: [],
  },
  {
    key: "mainland",
    label: "แผ่นดินใหญ่/ทวีป",
    category: "land",
    color: LAND,
    primary: "land",
    polygons: [
      land(
        blob({
          seed: 59,
          rx: 380,
          ry: 250,
          wobble: 0.2,
          n: 160,
          bumps: [
            { angle: 0.3, width: 0.25, amount: 0.35 },
            { angle: 1.6, width: 0.2, amount: -0.3 },
            { angle: 3.4, width: 0.3, amount: 0.3 },
            { angle: 4.6, width: 0.18, amount: -0.25 },
          ],
        })
      ),
    ],
    features: [],
  },
  {
    key: "archipelago",
    label: "หมู่เกาะ",
    category: "land",
    color: LAND,
    primary: "land",
    polygons: [
      land(blob({ seed: 71, rx: 40, ry: 28, cx: -110, cy: -30 })),
      land(blob({ seed: 72, rx: 28, ry: 22, cx: -40, cy: 35 })),
      land(blob({ seed: 73, rx: 52, ry: 34, cx: 35, cy: -20 })),
      land(blob({ seed: 74, rx: 22, ry: 18, cx: 105, cy: 30 })),
      land(blob({ seed: 75, rx: 18, ry: 14, cx: 140, cy: -35 })),
    ],
    features: [],
  },
  {
    key: "peninsula",
    label: "คาบสมุทร",
    category: "land",
    color: LAND,
    primary: "land",
    polygons: [land(blob({ seed: 83, rx: 110, ry: 85, wobble: 0.14, bumps: [{ angle: Math.PI / 2, width: 0.32, amount: 1.6 }] }))],
    features: [],
  },
  {
    key: "cape",
    label: "แหลม",
    category: "land",
    color: LAND,
    primary: "land",
    polygons: [land(blob({ seed: 89, rx: 120, ry: 70, wobble: 0.12, bumps: [{ angle: 0, width: 0.16, amount: 1.1 }] }))],
    features: [],
  },

  // ---- ชายฝั่ง/อ่าว/ช่องแคบ ----
  { key: "coast", label: "แนวชายฝั่ง", category: "coast", color: LAND, primary: "land", polygons: [land(coastStrip({ seed: 101, width: 420, depth: 160 }))], features: [] },
  {
    key: "bay-coast",
    label: "ชายฝั่งมีอ่าว",
    category: "coast",
    color: LAND,
    primary: "land",
    polygons: [land(coastStrip({ seed: 103, width: 420, depth: 200, bay: { at: 0.5, w: 0.12, d: 110 } }))],
    features: [],
  },
  {
    key: "bay-island",
    label: "เกาะมีอ่าว",
    category: "coast",
    color: LAND,
    primary: "land",
    polygons: [land(blob({ seed: 107, rx: 150, ry: 120, wobble: 0.14, bumps: [{ angle: -Math.PI / 2, width: 0.28, amount: -0.75 }] }))],
    features: [],
  },
  {
    key: "isthmus",
    label: "คอคอด (แผ่นดินเชื่อม)",
    category: "coast",
    color: LAND,
    primary: "land",
    polygons: [
      land(blob({ seed: 111, rx: 110, ry: 90, cx: -170 })),
      land(blob({ seed: 112, rx: 120, ry: 95, cx: 175 })),
      land(blob({ seed: 113, rx: 120, ry: 16, wobble: 0.25 })),
    ],
    features: [],
  },
  {
    key: "strait",
    label: "ช่องแคบ",
    category: "coast",
    color: LAND,
    primary: "land",
    polygons: [
      land(blob({ seed: 121, rx: 130, ry: 100, cx: -150 })),
      land(blob({ seed: 122, rx: 130, ry: 105, cx: 150 })),
      // ร่องน้ำตรงกลาง — วางทับแผ่นดินเดิมก็เจาะเป็นช่องแคบได้
      water(blob({ seed: 123, rx: 24, ry: 150, wobble: 0.2 })),
    ],
    features: [],
  },

  // ---- แหล่งน้ำ ----
  { key: "lake-small", label: "ทะเลสาบเล็ก", category: "water", color: LAKE, primary: "water", polygons: [water(blob({ seed: 131, rx: 40, ry: 28 }))], features: [] },
  {
    key: "lake-large",
    label: "ทะเลสาบใหญ่",
    category: "water",
    color: LAKE,
    primary: "water",
    polygons: [water(blob({ seed: 133, rx: 110, ry: 70, wobble: 0.22, bumps: [{ angle: 2.5, width: 0.3, amount: 0.35 }] }))],
    features: [],
  },
  {
    key: "inland-sea",
    label: "ทะเลใน",
    category: "water",
    color: "#5fa8d3",
    primary: "water",
    polygons: [water(blob({ seed: 137, rx: 200, ry: 120, wobble: 0.24, bumps: [{ angle: 0.2, width: 0.2, amount: 0.45 }, { angle: 3.9, width: 0.25, amount: -0.3 }] }))],
    features: [],
  },

  // ---- ภูมิประเทศ ----
  {
    key: "mountain-range",
    label: "แนวภูเขา",
    category: "terrain",
    color: ROCK,
    primary: "land",
    polygons: [land(blob({ seed: 141, rx: 175, ry: 45, wobble: 0.15 }))],
    features: ridge(142, 300, 7, 1.4),
  },
  { key: "mountains", label: "กลุ่มภูเขา", category: "terrain", color: ROCK, primary: "land", polygons: [land(blob({ seed: 145, rx: 85, ry: 65 }))], features: scatter(146, 5, 55, 40, "mountain", 1.5) },
  { key: "forest", label: "ป่าไม้", category: "terrain", color: FOREST, primary: "land", polygons: [land(blob({ seed: 151, rx: 120, ry: 80, wobble: 0.2 }))], features: scatter(152, 12, 95, 60, "forest", 1.1) },
  { key: "jungle", label: "ป่าเขตร้อน", category: "terrain", color: "#4e7a3c", primary: "land", polygons: [land(blob({ seed: 155, rx: 110, ry: 75 }))], features: scatter(156, 10, 85, 55, "coconut", 1.1) },
  { key: "desert", label: "ทะเลทราย", category: "terrain", color: DESERT, primary: "land", polygons: [land(blob({ seed: 161, rx: 150, ry: 95, wobble: 0.22 }))], features: [] },
  { key: "snowfield", label: "พื้นที่หิมะ", category: "terrain", color: SNOW, primary: "land", polygons: [land(blob({ seed: 171, rx: 150, ry: 90, wobble: 0.2 }))], features: [] },
  { key: "swamp", label: "ที่ลุ่ม/บึง", category: "terrain", color: "#6f7d55", primary: "land", polygons: [land(blob({ seed: 181, rx: 110, ry: 70 })), water(blob({ seed: 182, rx: 26, ry: 16, cx: -35, cy: 10 })), water(blob({ seed: 183, rx: 20, ry: 13, cx: 40, cy: -15 }))], features: [] },
];

export const PIECE_DEFS: PieceDef[] = RAW_PIECES.map((d) => ({ ...d, bounds: boundsOf(d.polygons, d.features) }));
const PIECE_BY_KEY = new Map(PIECE_DEFS.map((d) => [d.key, d]));

export function getPieceDef(key: string): PieceDef | undefined {
  return PIECE_BY_KEY.get(key);
}

// ---------- การแปลงพิกัด ----------

export function pieceTransform(p: Pick<MapPiece, "x" | "y" | "scale" | "rotation" | "flipX">): string {
  const s = p.scale ?? 1;
  return `translate(${p.x} ${p.y}) rotate(${p.rotation ?? 0}) scale(${p.flipX ? -s : s} ${s})`;
}

/** พิกัดแผนที่ → พิกัดภายในชิ้น (ย้อนการแปลงของ pieceTransform) */
export function toPieceLocal(p: Pick<MapPiece, "x" | "y" | "scale" | "rotation" | "flipX">, pt: Point): Point {
  const s = p.scale ?? 1;
  const r = (-(p.rotation ?? 0) * Math.PI) / 180;
  const dx = pt.x - p.x;
  const dy = pt.y - p.y;
  const rx = dx * Math.cos(r) - dy * Math.sin(r);
  const ry = dx * Math.sin(r) + dy * Math.cos(r);
  return { x: (p.flipX ? -rx : rx) / s, y: ry / s };
}

/** พิกัดภายในชิ้น → พิกัดแผนที่ */
export function fromPieceLocal(p: Pick<MapPiece, "x" | "y" | "scale" | "rotation" | "flipX">, pt: Point): Point {
  const s = p.scale ?? 1;
  const r = ((p.rotation ?? 0) * Math.PI) / 180;
  const lx = (p.flipX ? -pt.x : pt.x) * s;
  const ly = pt.y * s;
  return { x: p.x + lx * Math.cos(r) - ly * Math.sin(r), y: p.y + lx * Math.sin(r) + ly * Math.cos(r) };
}

export function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function hitPiece(p: MapPiece, pt: Point): boolean {
  const def = getPieceDef(p.piece);
  if (!def) return false;
  const local = toPieceLocal(p, pt);
  const b = def.bounds;
  if (local.x < b.minX || local.x > b.maxX || local.y < b.minY || local.y > b.maxY) return false;
  return def.polygons.some((pl) => pointInPolygon(local, pl.points)) || def.features.some((f) => Math.hypot(local.x - f.x, local.y - f.y) < 20 * f.scale);
}

export function piecePath(points: Point[]): string {
  return `M ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")} Z`;
}

export function piecePolygonColor(def: PieceDef, piece: Pick<MapPiece, "color">, role: "land" | "water"): string {
  if (role === def.primary) return piece.color ?? def.color;
  return role === "water" ? LAKE : def.color;
}

// ---------- การแสดงผล ----------

/** ไอคอนตกแต่งของชิ้น (ภูเขา/ต้นไม้) วาดเหนือภูมิประเทศ ตั้งตรงเสมอแม้หมุนชิ้น */
export function PieceFeatures({ piece }: { piece: MapPiece }) {
  const def = getPieceDef(piece.piece);
  if (!def || def.features.length === 0) return null;
  const s = piece.scale ?? 1;
  return (
    <g>
      {def.features.map((f, i) => {
        const pos = fromPieceLocal(piece, f);
        // ปัดทศนิยม — Math.cos/sin ฝั่งเซิร์ฟเวอร์กับเบราว์เซอร์ต่างกันที่หลักท้าย ๆ ทำให้ hydration ไม่ตรงกัน
        const x = Math.round(pos.x * 100) / 100;
        const y = Math.round(pos.y * 100) / 100;
        return <SvgStamp key={i} asset={getStampAsset(f.icon)} x={x} y={y} scale={Math.round(f.scale * s * 1000) / 1000} />;
      })}
    </g>
  );
}

/** รูปตัวอย่างในคลังชิ้นส่วน */
export function PieceThumbnail({ def, size = 64 }: { def: PieceDef; size?: number }) {
  const viewBox = useMemo(() => {
    const b = def.bounds;
    const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.06;
    const w = b.maxX - b.minX + pad * 2;
    const h = b.maxY - b.minY + pad * 2;
    const side = Math.max(w, h);
    return `${b.minX - pad - (side - w) / 2} ${b.minY - pad - (side - h) / 2} ${side} ${side}`;
  }, [def]);
  const stroke = Math.max(def.bounds.maxX - def.bounds.minX, def.bounds.maxY - def.bounds.minY) / 90;
  return (
    <svg viewBox={viewBox} width={size} height={size} aria-hidden>
      {def.polygons.map((pl, i) => (
        <path key={i} d={piecePath(pl.points)} fill={piecePolygonColor(def, {}, pl.role)} stroke="#3b3226" strokeOpacity={0.7} strokeWidth={stroke} strokeLinejoin="round" />
      ))}
      {def.features.map((f, i) =>
        f.icon === "mountain" ? (
          <path key={i} d={`M ${f.x - 14 * f.scale} ${f.y + 10 * f.scale} L ${f.x} ${f.y - 14 * f.scale} L ${f.x + 14 * f.scale} ${f.y + 10 * f.scale} Z`} fill="#6b6259" />
        ) : (
          <circle key={i} cx={f.x} cy={f.y} r={9 * f.scale} fill="#2f4a24" />
        )
      )}
    </svg>
  );
}
