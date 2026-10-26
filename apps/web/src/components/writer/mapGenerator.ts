/** ระบบสุ่มสร้างแผนที่ (Random Map Generator) — ประกอบแผนที่จากชิ้นส่วนในคลัง (mapPieces.tsx)
 *
 *  ทุกอย่างที่สร้างจากระบบสุ่มมีแท็ก `gen` (ชนิดขององค์ประกอบ) — การ "สุ่มเฉพาะบางประเภท" จะลบ/สร้างใหม่
 *  เฉพาะองค์ประกอบที่ระบบสุ่มสร้างไว้เองของประเภทนั้น สิ่งที่ผู้ใช้วางเองหรือแก้ไขแล้ว (WorldMap ลบแท็ก
 *  gen ทิ้งเมื่อผู้ใช้แก้) จะไม่ถูกแตะ
 *  seed เดียวกัน + การตั้งค่าเดียวกัน = ได้แผนที่เดิม (ใช้สร้างซ้ำ/แชร์รหัสแผนที่ได้) */

import type { LandStroke, Point, TerrainItem } from "@/components/writer/MapTerrain";
import { getPieceDef, mulberry32, pointInPolygon, toPieceLocal, type MapPiece } from "@/components/writer/mapPieces";
import { LABEL_CATEGORIES, type LabelCategory, type MapLabel } from "@/components/writer/MapLabels";

export type GenKind = "land" | "terrain" | "water" | "labels" | "settlements";

export const GEN_KINDS: { key: GenKind; label: string }[] = [
  { key: "land", label: "แผ่นดิน/เกาะ" },
  { key: "terrain", label: "ภูเขา/ป่า/ทะเลทราย/หิมะ" },
  { key: "water", label: "ทะเลสาบ/แหล่งน้ำ" },
  { key: "labels", label: "ชื่อทวีป/อาณาจักร/ทะเล" },
  { key: "settlements", label: "เมือง/หมู่บ้าน" },
];

export interface GenSettings {
  seed: number;
  /** จำนวนเกาะ/ทวีปหลัก */
  islands: number;
  landSize: "small" | "medium" | "large";
  /** ความหนาแน่นภูมิประเทศ 0..1 */
  density: number;
  /** จำนวนเมือง/หมู่บ้าน */
  settlements: number;
}

export interface GenStamp {
  id: string;
  kind: "stamp";
  icon: string;
  x: number;
  y: number;
  scale?: number;
  gen?: GenKind;
}

export type GenPiece = MapPiece & { gen?: GenKind };
export type GenLabel = MapLabel & { gen?: GenKind };
export type GenElement = GenPiece | GenLabel | GenStamp;

export function randomSeed(): number {
  // seed ของแผนที่สุ่ม (ผู้ใช้เห็นและพิมพ์ซ้ำได้) ไม่เกี่ยวกับความปลอดภัย
  return Math.floor(Math.random() * 900000) + 100000; // NOSONAR
}

// ---------- ชื่อสุ่มแนวแฟนตาซี ----------

const SYLLABLES = ["อัส", "ตรา", "เอล", "ดอร์", "คา", "ลิ", "วา", "รุ", "ธา", "นี", "โม", "เซ", "ริน", "กา", "ลา", "บา", "ซิ", "ออ", "รัน", "มี", "รา", "ทอร์", "วิน", "ฟา", "ลอน", "เวย์", "นอร์", "ไอ", "ยา", "กอร์", "ดิล", "เธีย", "โซล", "มาร์", "เคน", "ลีส"];

function makeName(rand: () => number, used: Set<string>): string {
  for (let tries = 0; tries < 30; tries++) {
    const n = rand() < 0.55 ? 2 : 3;
    let s = "";
    for (let i = 0; i < n; i++) s += SYLLABLES[Math.floor(rand() * SYLLABLES.length)];
    if (!used.has(s)) {
      used.add(s);
      return s;
    }
  }
  return SYLLABLES[Math.floor(rand() * SYLLABLES.length)] + used.size;
}

// ---------- ตรวจว่าจุดอยู่บนแผ่นดินไหม ----------

function distanceToPolyline(pt: Point, pts: Point[]): number {
  if (pts.length === 1) return Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y);
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy)));
  }
  return best;
}

/** สถานะของจุดตามลำดับชั้นภูมิประเทศ (ชั้นบนสุดที่ครอบจุดนั้นเป็นตัวตัดสิน) — ตรงกับที่ TerrainLayer วาด */
export function terrainAt(items: TerrainItem[], pt: Point): "land" | "water" | "none" {
  let state: "land" | "water" | "none" = "none";
  for (const item of items) {
    if (item.kind === "land") {
      const s = item as LandStroke;
      const inside = s.closed ? s.points.length >= 3 && pointInPolygon(pt, s.points) : distanceToPolyline(pt, s.points) <= s.brushSize;
      if (inside) state = s.mode === "add" ? "land" : s.mode === "water" ? "water" : "none";
      continue;
    }
    const def = getPieceDef(item.piece);
    if (!def) continue;
    const local = toPieceLocal(item, pt);
    const b = def.bounds;
    if (local.x < b.minX || local.x > b.maxX || local.y < b.minY || local.y > b.maxY) continue;
    for (const pl of def.polygons) if (pointInPolygon(local, pl.points)) state = pl.role;
  }
  return state;
}

/** จุดบนแผ่นดินที่มีแผ่นดินล้อมรอบ (ไม่ชิดชายฝั่งเกินไป) */
function isSolidLand(items: TerrainItem[], pt: Point, margin: number): boolean {
  if (terrainAt(items, pt) !== "land") return false;
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    if (terrainAt(items, { x: pt.x + Math.cos(ang) * margin, y: pt.y + Math.sin(ang) * margin }) !== "land") return false;
  }
  return true;
}

// ---------- ตัวสร้าง ----------

export interface GenContext {
  /** ภูมิประเทศที่มีอยู่แล้ว (ใช้หาจุดบนแผ่นดินตอนไม่ได้สุ่มแผ่นดินใหม่) */
  existingTerrain: TerrainItem[];
  /** จุดกึ่งกลางพื้นที่ที่จะสร้าง (พิกัดแผนที่) */
  center: Point;
  /** ชิ้นแผ่นดินที่มีอยู่แล้ว — ใช้ผูกชื่อทวีปเมื่อไม่ได้สุ่มแผ่นดินใหม่ */
  existingLandPieces: MapPiece[];
  /** จำนวนหมุดสถานที่ที่ต้องการตำแหน่งสุ่มบนแผ่นดิน */
  locationCount: number;
  /** id ชิ้นส่วนที่มีชื่อซึ่งผู้ใช้ตั้ง/แก้เองผูกอยู่ — แผ่นดินผืนนั้นจะไม่ถูกตั้งชื่อซ้ำ */
  namedPieceIds?: Set<string>;
}

export interface GenResult {
  /** องค์ประกอบใหม่แยกตามประเภท (WorldMap เป็นคนแทรกเข้าลำดับชั้นที่เหมาะสม) */
  byKind: Record<GenKind, GenElement[]>;
  /** ตำแหน่งสุ่มบนแผ่นดินสำหรับหมุดสถานที่ (จุดกึ่งกลางไอคอน) */
  locationSpots: Point[];
}

let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-g${Date.now().toString(36)}${idCounter}`;
}

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

function between(rand: () => number, a: number, b: number): number {
  return a + rand() * (b - a);
}

function pieceRadius(p: MapPiece): number {
  const def = getPieceDef(p.piece);
  if (!def) return 50;
  const b = def.bounds;
  return (Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2) * (p.scale ?? 1);
}

/** รวมชิ้นแผ่นดินที่ซ้อน/ชิดกันเป็นแผ่นดินผืนเดียว (union-find) — ชิ้นหลัก = ชิ้นที่ใหญ่ที่สุดในผืน */
function groupLandmasses(pieces: MapPiece[]): { main: MapPiece; center: Point; radius: number; members: string[] }[] {
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const d = Math.hypot(pieces[i].x - pieces[j].x, pieces[i].y - pieces[j].y);
      if (d < (pieceRadius(pieces[i]) + pieceRadius(pieces[j])) * 0.85) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, MapPiece[]>();
  pieces.forEach((p, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  });
  return [...groups.values()].map((members) => {
    const main = members.reduce((a, b) => (pieceRadius(b) > pieceRadius(a) ? b : a));
    const radius = Math.max(...members.map((m) => Math.hypot(m.x - main.x, m.y - main.y) + pieceRadius(m) * 0.6), pieceRadius(main));
    return { main, center: { x: main.x, y: main.y }, radius, members: members.map((m) => m.id) };
  });
}

export function generateMap(settings: GenSettings, kinds: Set<GenKind>, ctx: GenContext): GenResult {
  const rand = mulberry32(settings.seed);
  const usedNames = new Set<string>();
  const byKind: Record<GenKind, GenElement[]> = { land: [], terrain: [], water: [], labels: [], settlements: [] };

  const sizeFactor = settings.landSize === "small" ? 0.7 : settings.landSize === "large" ? 1.45 : 1;
  const count = Math.max(1, Math.min(10, Math.round(settings.islands)));
  // พื้นที่โลกโตตามจำนวน/ขนาดเกาะ
  const W = (700 + count * 260) * sizeFactor;
  const H = W * 0.62;
  const left = ctx.center.x - W / 2;
  const top = ctx.center.y - H / 2;

  // ---------- แผ่นดิน ----------
  type Landmass = { main: GenPiece; center: Point; radius: number; members?: string[] };
  const landmasses: Landmass[] = [];
  if (kinds.has("land")) {
    const minDist = Math.min(W, H) / (Math.sqrt(count) + 0.6);
    const centers: Point[] = [];
    for (let tries = 0; centers.length < count && tries < 400; tries++) {
      const pt = { x: between(rand, left + W * 0.12, left + W * 0.88), y: between(rand, top + H * 0.15, top + H * 0.85) };
      const need = tries > 250 ? minDist * 0.5 : minDist;
      if (centers.every((c) => Math.hypot(c.x - pt.x, c.y - pt.y) > need)) centers.push(pt);
    }
    centers.forEach((c, i) => {
      const isBig = i === 0 && count <= 4 && settings.landSize !== "small";
      const mainKey = isBig
        ? pick(rand, ["mainland", "island-large"])
        : settings.landSize === "small"
          ? pick(rand, ["island-round", "islet", "island-long", "cape"])
          : pick(rand, ["island-large", "island-round", "bay-island", "peninsula", "island-long"]);
      const baseScale = (isBig ? between(rand, 0.75, 1.05) : between(rand, 0.8, 1.3)) * sizeFactor * (count > 5 ? 0.75 : 1);
      const main: GenPiece = {
        id: genId("piece"),
        kind: "piece",
        piece: mainKey,
        x: Math.round(c.x),
        y: Math.round(c.y),
        scale: Math.round(baseScale * 100) / 100,
        rotation: Math.round(between(rand, 0, 360)),
        flipX: rand() < 0.5,
        gen: "land",
      };
      byKind.land.push(main);
      const radius = pieceRadius(main);
      // ส่วนต่อ (คาบสมุทร/แหลม/เกาะเล็ก) ซ้อนขอบชิ้นหลัก ให้รูปร่างแผ่นดินไม่ซ้ำกัน
      const extras = settings.landSize === "small" ? Math.floor(rand() * 2) : 1 + Math.floor(rand() * 3);
      for (let k = 0; k < extras; k++) {
        const ang = rand() * Math.PI * 2;
        const dist = radius * between(rand, 0.55, 0.85);
        byKind.land.push({
          id: genId("piece"),
          kind: "piece",
          piece: pick(rand, ["peninsula", "cape", "island-round", "island-long", "islet"]),
          x: Math.round(c.x + Math.cos(ang) * dist),
          y: Math.round(c.y + Math.sin(ang) * dist),
          scale: Math.round(baseScale * between(rand, 0.45, 0.8) * 100) / 100,
          rotation: Math.round((ang * 180) / Math.PI - 90 + between(rand, -30, 30)),
          flipX: rand() < 0.5,
          gen: "land",
        });
      }
      // เกาะบริวาร/หมู่เกาะห่างฝั่ง
      if (rand() < 0.45) {
        const ang = rand() * Math.PI * 2;
        const dist = radius * between(rand, 1.15, 1.5);
        byKind.land.push({
          id: genId("piece"),
          kind: "piece",
          piece: pick(rand, ["archipelago", "islet", "islet"]),
          x: Math.round(c.x + Math.cos(ang) * dist),
          y: Math.round(c.y + Math.sin(ang) * dist),
          scale: Math.round(sizeFactor * between(rand, 0.6, 1) * 100) / 100,
          rotation: Math.round(between(rand, 0, 360)),
          gen: "land",
        });
      }
      landmasses.push({ main, center: c, radius });
    });
  }

  // ภูมิประเทศที่ใช้หาจุดบนแผ่นดิน = ของเดิมที่ยังคงอยู่ (WorldMap ตัดของที่จะถูกแทนที่ออกแล้ว) + แผ่นดินที่เพิ่งสุ่ม
  const terrain: TerrainItem[] = [...ctx.existingTerrain, ...(byKind.land as MapPiece[])];
  if (!kinds.has("land")) landmasses.push(...groupLandmasses(ctx.existingLandPieces));

  // กรอบค้นหาจุด: จากแผ่นดินที่มี (ถ้าไม่มีแผ่นดินเลย ใช้กรอบโลก)
  function searchBox(): { x0: number; y0: number; x1: number; y1: number } {
    if (landmasses.length === 0) return { x0: left, y0: top, x1: left + W, y1: top + H };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const l of landmasses) {
      x0 = Math.min(x0, l.center.x - l.radius * 1.3);
      y0 = Math.min(y0, l.center.y - l.radius * 1.3);
      x1 = Math.max(x1, l.center.x + l.radius * 1.3);
      y1 = Math.max(y1, l.center.y + l.radius * 1.3);
    }
    return { x0, y0, x1, y1 };
  }
  const box = searchBox();

  function landSpot(margin: number, avoid: Point[], minGap: number, filter?: (pt: Point) => boolean): Point | null {
    for (let tries = 0; tries < 300; tries++) {
      const pt = { x: between(rand, box.x0, box.x1), y: between(rand, box.y0, box.y1) };
      if (filter && !filter(pt)) continue;
      if (avoid.some((a) => Math.hypot(a.x - pt.x, a.y - pt.y) < minGap)) continue;
      if (isSolidLand(terrain, pt, margin)) return pt;
    }
    return null;
  }

  // ---------- ภูมิประเทศ (ภูเขา/ป่า/ทะเลทราย/หิมะ) ----------
  const placedFeatures: Point[] = [];
  if (kinds.has("terrain")) {
    const totalArea = landmasses.reduce((sum, l) => sum + l.radius * l.radius, 0) || W * H * 0.1;
    const n = Math.round(settings.density * (2 + Math.sqrt(totalArea) / 60));
    const spanY = box.y1 - box.y0 || 1;
    for (let i = 0; i < n; i++) {
      const pt = landSpot(25 * sizeFactor, placedFeatures, 110 * sizeFactor);
      if (!pt) break;
      placedFeatures.push(pt);
      // "ภูมิอากาศ" ตามละติจูด: เหนือ = หิมะ/ภูเขา, ใต้ = ทะเลทราย/ป่าเขตร้อน
      const lat = (pt.y - box.y0) / spanY;
      const key =
        lat < 0.22
          ? pick(rand, ["snowfield", "snowfield", "mountains", "mountain-range"])
          : lat > 0.75
            ? pick(rand, ["desert", "desert", "jungle", "mountains"])
            : pick(rand, ["forest", "forest", "mountain-range", "mountains", "swamp", "jungle"]);
      const isRegion = key === "desert" || key === "snowfield";
      byKind.terrain.push({
        id: genId("piece"),
        kind: "piece",
        piece: key,
        x: Math.round(pt.x),
        y: Math.round(pt.y),
        scale: Math.round(between(rand, isRegion ? 0.55 : 0.45, isRegion ? 0.95 : 0.8) * sizeFactor * 100) / 100,
        rotation: Math.round(key === "mountain-range" ? between(rand, -35, 35) : between(rand, 0, 360)),
        flipX: rand() < 0.5,
        gen: "terrain",
      });
    }
  }

  // ---------- แหล่งน้ำ (ทะเลสาบ) ----------
  if (kinds.has("water")) {
    const n = Math.max(0, Math.round(settings.density * landmasses.length * 1.2 + (rand() < 0.5 ? 1 : 0)));
    const lakes: Point[] = [];
    for (let i = 0; i < n; i++) {
      const big = rand() < 0.3;
      const pt = landSpot((big ? 110 : 60) * sizeFactor, [...lakes, ...placedFeatures], 90 * sizeFactor);
      if (!pt) continue;
      lakes.push(pt);
      byKind.water.push({
        id: genId("piece"),
        kind: "piece",
        piece: big ? "lake-large" : "lake-small",
        x: Math.round(pt.x),
        y: Math.round(pt.y),
        scale: Math.round(between(rand, 0.5, 0.9) * sizeFactor * 100) / 100,
        rotation: Math.round(between(rand, 0, 360)),
        gen: "water",
      });
    }
  }

  // ---------- เมือง/หมู่บ้าน ----------
  const settlementSpots: Point[] = [];
  if (kinds.has("settlements")) {
    for (let i = 0; i < settings.settlements; i++) {
      const pt = landSpot(18 * sizeFactor, [...settlementSpots, ...placedFeatures.map((p) => p)], 85 * sizeFactor);
      if (!pt) break;
      settlementSpots.push(pt);
      const isCity = rand() < 0.4;
      const cat = LABEL_CATEGORIES.find((c) => c.key === "city")!;
      byKind.settlements.push({ id: genId("stamp"), kind: "stamp", icon: "house", x: Math.round(pt.x), y: Math.round(pt.y), scale: isCity ? 1.1 : 0.8, gen: "settlements" });
      byKind.settlements.push({
        id: genId("label"),
        kind: "label",
        text: `${isCity ? "นคร" : "หมู่บ้าน"}${makeName(rand, usedNames)}`,
        x: Math.round(pt.x),
        y: Math.round(pt.y + (isCity ? 30 : 24)),
        category: "city",
        ...cat.preset,
        size: isCity ? 15 : 12,
        gen: "settlements",
      });
    }
  }

  // ---------- ชื่อทวีป/อาณาจักร/ทะเล ----------
  if (kinds.has("labels")) {
    const named = ctx.namedPieceIds ?? new Set<string>();
    const sorted = [...landmasses].filter((l) => !l.members?.some((id) => named.has(id)) && !named.has(l.main.id)).sort((a, b) => b.radius - a.radius);
    sorted.forEach((l, i) => {
      const category: LabelCategory = i === 0 && l.radius > 220 ? "continent" : l.radius > 120 ? "kingdom" : "region";
      const cat = LABEL_CATEGORIES.find((c) => c.key === category)!;
      const prefix = category === "continent" ? "ทวีป" : category === "kingdom" ? "อาณาจักร" : "เกาะ";
      byKind.labels.push({
        id: genId("label"),
        kind: "label",
        text: `${prefix}${makeName(rand, usedNames)}`,
        x: Math.round(l.center.x),
        y: Math.round(l.center.y),
        category,
        ...cat.preset,
        attachTo: l.main.id,
        gen: "labels",
      });
    });
    // ชื่อทะเล 1–2 แห่ง ในจุดที่ไม่ใช่แผ่นดิน
    const seaCount = landmasses.length > 1 ? 2 : 1;
    const seaSpots: Point[] = [];
    for (let i = 0; i < seaCount; i++) {
      for (let tries = 0; tries < 200; tries++) {
        // ทะเลรอบ ๆ แผ่นดิน (ไม่ไกลออกไปกลางมหาสมุทร ไม่งั้นแผนที่ต้องซูมออกมากเกินเวลาดูทั้งแผนที่)
        const mx = (box.x1 - box.x0) * 0.12;
        const my = (box.y1 - box.y0) * 0.12;
        const pt = { x: between(rand, box.x0 - mx, box.x1 + mx), y: between(rand, box.y0 - my, box.y1 + my) };
        if (terrainAt(terrain, pt) === "land") continue;
        if (landmasses.some((l) => Math.hypot(l.center.x - pt.x, l.center.y - pt.y) < l.radius * 1.05)) continue;
        if (seaSpots.some((s) => Math.hypot(s.x - pt.x, s.y - pt.y) < (box.x1 - box.x0) / 3)) continue;
        seaSpots.push(pt);
        byKind.labels.push({
          id: genId("label"),
          kind: "label",
          text: `ทะเล${makeName(rand, usedNames)}`,
          x: Math.round(pt.x),
          y: Math.round(pt.y),
          category: "region",
          size: 18,
          color: "#1e3a5f",
          font: "serif",
          italic: true,
          spacing: 0.04,
          gen: "labels",
        });
        break;
      }
    }
  }

  // ---------- ตำแหน่งหมุดสถานที่ ----------
  const locationSpots: Point[] = [];
  for (let i = 0; i < ctx.locationCount; i++) {
    const pt = landSpot(20, [...locationSpots, ...settlementSpots], 110 * sizeFactor) ?? landSpot(10, locationSpots, 50);
    if (!pt) break;
    locationSpots.push(pt);
  }

  return { byKind, locationSpots };
}
