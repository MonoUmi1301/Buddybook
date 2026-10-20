"use client";

/** เลเยอร์ภูมิประเทศของแผนที่โลก (แผ่นดิน/น้ำ/พื้นหลัง) — แยกจาก WorldMap.tsx
 *
 *  โมเดลข้อมูล (เก็บใน novel.map_drawings เหมือนองค์ประกอบอื่น):
 *  - kind "land" mode "add"      = แปรง/รูปร่างแผ่นดิน (สีตามภูมิประเทศ เช่น หญ้า/ทะเลทราย/หิมะ)
 *  - kind "land" mode "water"    = แปรง/รูปร่างน้ำ — เจาะแผ่นดินเป็นทะเลสาบ/อ่าว/ช่องแคบ และระบายสีน้ำ
 *  - kind "land" mode "subtract" = ยางลบ — ลบทั้งแผ่นดินและน้ำ เหลือแต่พื้นหลัง
 *  - closed: true = รูปร่างปิดที่ลากด้วยเครื่องมือ "วาดรูปร่าง" (lasso) แทนเส้นแปรง
 *  - kind "base" (มีได้อันเดียว) = สีพื้นหลัง/มหาสมุทร + เปิด-ปิดพื้นผิวแฟนตาซี
 *
 *  การเรนเดอร์ composite ผ่าน SVG <mask> ตามลำดับที่วาด (stroke หลังทับ stroke ก่อน) แล้วใส่
 *  ฟิลเตอร์ SVG แบบ procedural (feTurbulence) ให้ขอบชายฝั่งขรุขระเป็นธรรมชาติ มีแสงน้ำตื้นรอบเกาะ
 *  เส้นขอบฝั่ง แถบหาดสีอ่อน และพื้นผิวลายกระดาษ/ลายน้ำ — ไม่ต้องใช้ไฟล์ texture จึงไม่มีปัญหา
 *  ลิขสิทธิ์และไม่เพิ่มขนาดหน้าเว็บ ฟิลเตอร์จำกัดพื้นที่ไว้แค่ส่วนที่มองเห็นบนจอ (view) กันหนักเครื่อง
 *  ลายสุ่มอยู่ในพิกัดแผนที่ (userSpaceOnUse) ลายจึงเลื่อนไปพร้อมแผนที่ตอน pan/zoom ไม่ "ไหล" */

import { getPieceDef, piecePath, piecePolygonColor, pieceTransform, type MapPiece } from "@/components/writer/mapPieces";

export type Point = { x: number; y: number };
export type LandMode = "add" | "subtract" | "water";

export interface LandStroke {
  id: string;
  kind: "land";
  points: Point[];
  brushSize: number;
  mode: LandMode;
  color: string;
  closed?: boolean;
}

export interface MapBase {
  id: string;
  kind: "base";
  /** สีพื้นหลัง/มหาสมุทร — null = ไม่มีพื้นหลัง (พื้นกระดาษเดิมของหน้าเว็บ) */
  color: string | null;
  /** พื้นผิวแฟนตาซี (ขอบชายฝั่งธรรมชาติ + ลายพื้นผิว) — ไม่ระบุ = เปิด */
  texture?: boolean;
}

export const BASE_ID = "map-base";
export const DEFAULT_BASE: MapBase = { id: BASE_ID, kind: "base", color: null, texture: true };

export const LAND_PRESETS = [
  { key: "grass", label: "หญ้า", color: "#86a05c" },
  { key: "forest", label: "ป่าทึบ", color: "#5f7f45" },
  { key: "desert", label: "ทะเลทราย", color: "#e0c16c" },
  { key: "plain", label: "ทุ่งแห้ง", color: "#c9b27c" },
  { key: "snow", label: "หิมะ", color: "#e8eef2" },
  { key: "rock", label: "หิน/ภูเขา", color: "#9a9187" },
  { key: "swamp", label: "บึง", color: "#6f7d55" },
  { key: "lava", label: "ลาวา", color: "#dc2626" },
];

export const WATER_PRESETS = [
  { key: "sea", label: "ทะเล", color: "#5fa8d3" },
  { key: "deep", label: "ทะเลลึก", color: "#2f6f9f" },
  { key: "lake", label: "ทะเลสาบ", color: "#7cc4d8" },
  { key: "teal", label: "น้ำเขียว", color: "#4f9a94" },
  { key: "dark", label: "ทะเลมืด", color: "#24425e" },
];

export const BASE_PRESETS: { label: string; color: string | null }[] = [
  { label: "ไม่มี (พื้นเดิม)", color: null },
  { label: "มหาสมุทร", color: "#5fa8d3" },
  { label: "ทะเลลึก", color: "#2f6f9f" },
  { label: "ทะเลมืด", color: "#24425e" },
  { label: "กระดาษเก่า", color: "#eadcb8" },
];

export function pointsToSvgPath(points: Point[], close = false): string {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  const d = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
  return close ? `${d} Z` : d;
}

/** เส้น/รูปร่างหนึ่งชิ้นของภูมิประเทศ ด้วยสีที่กำหนด (ใช้ทั้งใน mask และชั้นสี) */
function StrokeShape({ stroke, paint }: { stroke: Pick<LandStroke, "points" | "brushSize" | "closed">; paint: string }) {
  if (stroke.closed) {
    return <path d={pointsToSvgPath(stroke.points, true)} fill={paint} stroke={paint} strokeWidth={1} strokeLinejoin="round" />;
  }
  return (
    <path
      d={pointsToSvgPath(stroke.points)}
      fill="none"
      stroke={paint}
      strokeWidth={stroke.brushSize * 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// ค่า turbulence ของขอบชายฝั่ง — ต้องเหมือนกันทั้งฟิลเตอร์แผ่นดินและน้ำ ขอบทั้งสองชั้นจะได้บิดตรงกัน
const COAST_NOISE = { baseFrequency: "0.035", numOctaves: 3, seed: 7 } as const;
const COAST_DISPLACEMENT = 14;

// ฟิลเตอร์ลายพื้นผิว: noise ขาวดำแบบทึบ แล้วบีบช่วงค่าให้อยู่ราว 0.8–1.0 ไว้คูณกับสีพื้น
// คูณด้วย feComposite arithmetic (k1) ไม่ใช่ feBlend multiply — blend จะเอาสี noise มาเติมตรงขอบที่
// โปร่งแสง ทำให้เกิดวงสีเทาอ่อนรอบพื้นที่ที่ระบาย
function TextureNoise({ freq, octaves, seed, slope, intercept, result }: { freq: string; octaves: number; seed: number; slope: number; intercept: number; result: string }) {
  return (
    <>
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={octaves} seed={seed} result={`${result}-raw`} />
      <feColorMatrix
        in={`${result}-raw`}
        type="matrix"
        values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1"
        result={`${result}-gray`}
      />
      <feComponentTransfer in={`${result}-gray`} result={result}>
        <feFuncR type="linear" slope={slope} intercept={intercept} />
        <feFuncG type="linear" slope={slope} intercept={intercept} />
        <feFuncB type="linear" slope={slope} intercept={intercept} />
      </feComponentTransfer>
    </>
  );
}

function TerrainFilters({ ids, view }: { ids: { land: string; water: string; base: string }; view: View }) {
  const region = { filterUnits: "userSpaceOnUse" as const, x: view.x, y: view.y, width: view.w, height: view.h, colorInterpolationFilters: "sRGB" as const };
  return (
    <>
      <filter id={ids.land} {...region}>
        {/* ขอบชายฝั่งขรุขระแบบธรรมชาติ */}
        <feTurbulence type="fractalNoise" {...COAST_NOISE} result="coastNoise" />
        <feDisplacementMap in="SourceGraphic" in2="coastNoise" scale={COAST_DISPLACEMENT} xChannelSelector="R" yChannelSelector="G" result="land" />
        <feColorMatrix in="land" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="landA" />
        {/* แสงน้ำตื้นรอบชายฝั่ง */}
        <feMorphology in="landA" operator="dilate" radius="3" result="glowBase" />
        <feGaussianBlur in="glowBase" stdDeviation="9" result="glowBlur" />
        <feFlood floodColor="#ffffff" floodOpacity="0.5" />
        <feComposite operator="in" in2="glowBlur" result="glow" />
        {/* เส้นขอบฝั่ง */}
        <feMorphology in="landA" operator="dilate" radius="1.5" result="coastA" />
        <feFlood floodColor="#3b3226" floodOpacity="0.8" />
        <feComposite operator="in" in2="coastA" result="coast" />
        {/* ลายพื้นผิว: ด่างใหญ่ + เกรนละเอียดแบบกระดาษ */}
        <TextureNoise freq="0.012" octaves={4} seed={11} slope={0.55} intercept={0.62} result="patches" />
        <TextureNoise freq="0.55" octaves={1} seed={3} slope={0.3} intercept={0.82} result="grain" />
        <feComposite in="land" in2="patches" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="landTex1" />
        <feComposite in="landTex1" in2="grain" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="landTex2" />
        <feComposite in="landTex2" in2="land" operator="in" result="landTex" />
        {/* แถบหาดสีอ่อนด้านในชายฝั่ง */}
        <feGaussianBlur in="landA" stdDeviation="5" result="innerBlur" />
        <feComposite in="landA" in2="innerBlur" operator="out" result="edgeBand" />
        <feFlood floodColor="#fff6d6" floodOpacity="0.6" />
        <feComposite operator="in" in2="edgeBand" result="beach" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="coast" />
          <feMergeNode in="landTex" />
          <feMergeNode in="beach" />
        </feMerge>
      </filter>

      <filter id={ids.water} {...region}>
        <feTurbulence type="fractalNoise" {...COAST_NOISE} result="coastNoise" />
        <feDisplacementMap in="SourceGraphic" in2="coastNoise" scale={COAST_DISPLACEMENT} xChannelSelector="R" yChannelSelector="G" result="waterHard" />
        {/* ขอบนุ่มเล็กน้อย — น้ำที่ระบายทับมหาสมุทรจะกลืนไปกับพื้น ไม่เห็นรอยต่อเป็นเส้น */}
        <feGaussianBlur in="waterHard" stdDeviation="2.5" result="water" />
        <TextureNoise freq="0.006 0.012" octaves={3} seed={5} slope={0.45} intercept={0.75} result="depth" />
        <TextureNoise freq="0.02 0.18" octaves={2} seed={9} slope={0.25} intercept={0.85} result="ripple" />
        <feComposite in="water" in2="depth" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="waterTex1" />
        <feComposite in="waterTex1" in2="ripple" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="waterTex2" />
        <feComposite in="waterTex2" in2="water" operator="in" />
      </filter>

      <filter id={ids.base} {...region}>
        <TextureNoise freq="0.006 0.012" octaves={3} seed={5} slope={0.45} intercept={0.75} result="depth" />
        <TextureNoise freq="0.02 0.18" octaves={2} seed={9} slope={0.25} intercept={0.85} result="ripple" />
        <feComposite in="SourceGraphic" in2="depth" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="baseTex1" />
        <feComposite in="baseTex1" in2="ripple" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="baseTex2" />
        <feComposite in="baseTex2" in2="SourceGraphic" operator="in" />
      </filter>
    </>
  );
}

/** พื้นที่ที่มองเห็นบนจอ ในพิกัดแผนที่ */
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** สิ่งที่ประกอบเป็นภูมิประเทศ เรียงตามลำดับชั้น (อันหลังทับอันก่อน) */
export type TerrainItem = LandStroke | MapPiece;

type Layer = "landMask" | "waterMask" | "landPaint" | "waterPaint";

/** วาดชิ้นภูมิประเทศหนึ่งชิ้นสำหรับชั้นที่ระบุ — คืน null ถ้าชิ้นนี้ไม่มีส่วนในชั้นนั้น */
function TerrainItemShape({ item, layer }: { item: TerrainItem; layer: Layer }) {
  if (item.kind === "land") {
    const isLand = item.mode === "add";
    const isWater = item.mode === "water";
    if (layer === "landMask") return <StrokeShape stroke={item} paint={isLand ? "white" : "black"} />;
    if (layer === "waterMask") return <StrokeShape stroke={item} paint={isWater ? "white" : "black"} />;
    if (layer === "landPaint") return isLand ? <StrokeShape stroke={item} paint={item.color} /> : null;
    return isWater ? <StrokeShape stroke={item} paint={item.color} /> : null;
  }
  const def = getPieceDef(item.piece);
  if (!def) return null;
  const paths = def.polygons
    .map((pl, i) => {
      let paint: string | null;
      if (layer === "landMask") paint = pl.role === "land" ? "white" : "black";
      else if (layer === "waterMask") paint = pl.role === "water" ? "white" : "black";
      else if (layer === "landPaint") paint = pl.role === "land" ? piecePolygonColor(def, item, "land") : null;
      else paint = pl.role === "water" ? piecePolygonColor(def, item, "water") : null;
      return paint ? <path key={i} d={piecePath(pl.points)} fill={paint} /> : null;
    })
    .filter(Boolean);
  if (paths.length === 0) return null;
  return <g transform={pieceTransform(item)}>{paths}</g>;
}

/** วาดใน <g> ที่ transform ตาม viewport แล้ว (อยู่ใน DrawingLayer ของ WorldMap) */
export function TerrainLayer({ strokes, base, view }: { strokes: TerrainItem[]; base: MapBase; view: View }) {
  const ids = { land: "terrain-land-fx", water: "terrain-water-fx", base: "terrain-base-fx", landMask: "terrain-land-mask", waterMask: "terrain-water-mask" };
  const textured = base.texture !== false;
  const hasWater = strokes.some((s) =>
    s.kind === "land" ? s.mode === "water" : getPieceDef(s.piece)?.polygons.some((pl) => pl.role === "water")
  );
  const maskRegion = { maskUnits: "userSpaceOnUse" as const, x: view.x, y: view.y, width: view.w, height: view.h };

  return (
    <>
      <defs>
        {/* แผ่นดิน: เพิ่ม = ขาว, น้ำ/ยางลบ = ดำ — ตามลำดับที่วาด */}
        <mask id={ids.landMask} {...maskRegion}>
          {strokes.map((s) => (
            <TerrainItemShape key={s.id} item={s} layer="landMask" />
          ))}
        </mask>
        {/* น้ำ: แปรงน้ำ = ขาว, แผ่นดิน/ยางลบ = ดำ (แผ่นดินที่ทับทีหลังแทนที่น้ำ) */}
        {hasWater && (
          <mask id={ids.waterMask} {...maskRegion}>
            {strokes.map((s) => (
              <TerrainItemShape key={s.id} item={s} layer="waterMask" />
            ))}
          </mask>
        )}
        {textured && <TerrainFilters ids={ids} view={view} />}
      </defs>

      {base.color && <rect x={view.x} y={view.y} width={view.w} height={view.h} fill={base.color} filter={textured ? `url(#${ids.base})` : undefined} />}

      {hasWater && (
        <g filter={textured ? `url(#${ids.water})` : undefined}>
          <g mask={`url(#${ids.waterMask})`}>
            {strokes.map((s) => (
              <TerrainItemShape key={s.id} item={s} layer="waterPaint" />
            ))}
          </g>
        </g>
      )}

      <g filter={textured ? `url(#${ids.land})` : undefined}>
        <g mask={`url(#${ids.landMask})`} opacity={textured ? 1 : 0.85}>
          {strokes.map((s) => (
            <TerrainItemShape key={s.id} item={s} layer="landPaint" />
          ))}
        </g>
      </g>
    </>
  );
}

/** พรีวิวเส้นที่กำลังลากอยู่ — วาดนอกฟิลเตอร์ (ไม่งั้นต้องคำนวณฟิลเตอร์ทั้งจอใหม่ทุกครั้งที่ขยับเมาส์)
 *  ฟิลเตอร์จริงคำนวณครั้งเดียวตอนปล่อยเมาส์ */
export function TerrainStrokePreview({ stroke, zoom }: { stroke: Omit<LandStroke, "id" | "kind">; zoom: number }) {
  const paint = stroke.mode === "subtract" ? "#ffffff" : stroke.color;
  const outline = { stroke: "#1c1917", strokeOpacity: 0.6, strokeWidth: 1.5 / zoom, strokeDasharray: `${6 / zoom} ${4 / zoom}` };
  if (stroke.closed) {
    return <path d={pointsToSvgPath(stroke.points, true)} fill={paint} fillOpacity={0.55} strokeLinejoin="round" {...outline} />;
  }
  return (
    <path
      d={pointsToSvgPath(stroke.points)}
      fill="none"
      stroke={paint}
      strokeOpacity={stroke.mode === "subtract" ? 0.7 : 0.8}
      strokeWidth={stroke.brushSize * 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
