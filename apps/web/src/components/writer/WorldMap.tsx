"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  useViewport,
  useReactFlow,
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
  Mountain,
  TreePine,
  Trees,
  Waves,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { LocationNode, LOCATION_ICONS, type LocationNodeData, type LocationIconKey } from "@/components/writer/LocationNode";
import { AddLocationModal } from "@/components/writer/AddLocationModal";
import { LoreModal, type ChapterOption } from "@/components/writer/LoreModal";

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
  | { id: string; kind: "land"; points: { x: number; y: number }[]; brushSize: number; mode: "add" | "subtract"; color: string }
  | { id: string; kind: "stamp"; icon: string; x: number; y: number; rotation?: number; scale?: number };

export type MapDrawing = MapElement;

interface WorldMapProps {
  novelId: string;
  initialLocations: LocationRecord[];
  initialEdges: Edge[];
  initialDrawings: MapDrawing[];
  chapters: ChapterOption[];
}

const LOCATION_NODE_WIDTH = 88;
const LOCATION_NODE_HEIGHT = 90;

const TERRAIN_PRESETS = [
  { key: "grass", label: "หญ้า", color: "#86a05c" },
  { key: "desert", label: "ทะเลทราย", color: "#e0c16c" },
  { key: "sea", label: "ทะเล", color: "#5fa8d3" },
  { key: "snow", label: "หิมะ", color: "#e8eef2" },
  { key: "lava", label: "ลาวา", color: "#dc2626" },
];

const STAMP_ICONS: Record<string, typeof Mountain> = {
  mountain: Mountain,
  tree: TreePine,
  forest: Trees,
  river: Waves,
};
const STAMP_OPTIONS = [
  { key: "mountain", label: "เทือกเขา" },
  { key: "tree", label: "ต้นไม้" },
  { key: "forest", label: "ป่าทึบ" },
  { key: "river", label: "แม่น้ำ" },
];

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
    width: LOCATION_NODE_WIDTH,
    height: LOCATION_NODE_HEIGHT,
    // เพิ่มภายหลัง (audit fix) — ผู้ใช้ขอให้ลากถนนได้อิสระรอบไอคอน ไม่ใช่แค่ซ้าย-ขวา จึงเพิ่มเป็น
    // 4 ทิศ ทุกจุดเป็น source ทั้งหมด คู่กับ connectionMode="loose" ด้านล่าง (เหมือน CharacterGraph)
    handles: [
      { id: "top", type: "source", position: Position.Top, x: LOCATION_NODE_WIDTH / 2, y: 0 },
      { id: "right", type: "source", position: Position.Right, x: LOCATION_NODE_WIDTH, y: LOCATION_NODE_HEIGHT / 2 },
      { id: "bottom", type: "source", position: Position.Bottom, x: LOCATION_NODE_WIDTH / 2, y: LOCATION_NODE_HEIGHT },
      { id: "left", type: "source", position: Position.Left, x: 0, y: LOCATION_NODE_HEIGHT / 2 },
    ],
  };
}

function isPlaced(l: LocationRecord): boolean {
  return l.pos_x !== null && l.pos_y !== null;
}

function pointsToSvgPath(points: { x: number; y: number }[], close = false): string {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  const d = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
  return close ? `${d} Z` : d;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Land Tool — คำนวณครั้งเดียวตอนปล่อยเมาส์ (pointer up) ไม่ใช่ทุก frame ระหว่างลาก เพื่อไม่ให้หนักเว็บ
function jitterPoints(points: { x: number; y: number }[], amount: number): { x: number; y: number }[] {
  if (amount <= 0) return points;
  return points.map((p) => ({
    x: p.x + (Math.random() - 0.5) * amount,
    y: p.y + (Math.random() - 0.5) * amount,
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

type ActiveStroke =
  | { kind: "line"; points: { x: number; y: number }[]; width: number }
  | { kind: "land"; points: { x: number; y: number }[]; color: string; brushSize: number; landMode: "add" | "subtract" };

/** เลเยอร์แสดงองค์ประกอบอิสระบนแผนที่ (เส้น/พื้นที่ระบายสี/ไอคอนปั๊ม/Land Tool) ซิงก์ตำแหน่งตามการ
 *  pan/zoom ของแคนวาสผ่าน useViewport() — เรนเดอร์เป็น <svg> ซ้อนอยู่ใต้เลเยอร์ตัวโหนดสถานที่
 *  Land Tool ("land") composite ผ่าน SVG <mask>: stroke สีขาว = เพิ่มพื้นที่, สีดำ = ลบพื้นที่
 *  เรียงตามลำดับที่วาด (stroke หลังทับ stroke ก่อนที่จุดเดียวกัน) — เลือกวิธีนี้เพราะเบากว่ามาก
 *  เทียบกับ raster masking หรือไลบรารี polygon-boolean และ browser จัดการ stroke-to-fill ให้เอง */
function DrawingLayer({ elements, activeStroke }: { elements: MapElement[]; activeStroke: ActiveStroke | null }) {
  const { x, y, zoom } = useViewport();
  const maskId = "world-map-land-mask";
  const landElements = elements.filter((el): el is Extract<MapElement, { kind: "land" }> => el.kind === "land");
  const otherElements = elements.filter((el) => el.kind !== "land");
  const activeLand = activeStroke?.kind === "land" ? activeStroke : null;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x={-100000} y={-100000} width={200000} height={200000}>
            {landElements.map((el) => (
              <path
                key={el.id}
                d={pointsToSvgPath(el.points)}
                fill="none"
                stroke={el.mode === "subtract" ? "black" : "white"}
                strokeWidth={el.brushSize * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {activeLand && (
              <path
                d={pointsToSvgPath(activeLand.points)}
                fill="none"
                stroke={activeLand.landMode === "subtract" ? "black" : "white"}
                strokeWidth={activeLand.brushSize * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </mask>
        </defs>

        <g mask={`url(#${maskId})`}>
          {landElements
            .filter((el) => el.mode === "add")
            .map((el) => (
              <path
                key={el.id}
                d={pointsToSvgPath(el.points)}
                fill="none"
                stroke={el.color}
                strokeWidth={el.brushSize * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            ))}
          {activeLand && activeLand.landMode === "add" && (
            <path
              d={pointsToSvgPath(activeLand.points)}
              fill="none"
              stroke={activeLand.color}
              strokeWidth={activeLand.brushSize * 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
          )}
        </g>

        {otherElements.map((el) => {
          if (el.kind === "fill") {
            return <path key={el.id} d={pointsToSvgPath(el.points, true)} fill={el.color} fillOpacity={0.45} stroke={el.color} strokeWidth={1} />;
          }
          if (el.kind === "stamp") {
            const StampIcon = STAMP_ICONS[el.icon] ?? Mountain;
            const size = 28 * (el.scale ?? 1);
            return (
              <StampIcon
                key={el.id}
                x={el.x - size / 2}
                y={el.y - size / 2}
                width={size}
                height={size}
                color="#57534e"
                style={{ transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, transformOrigin: `${el.x}px ${el.y}px` }}
              />
            );
          }
          return (
            <path
              key={el.id}
              d={pointsToSvgPath(el.points)}
              fill="none"
              stroke={el.color || "#b45309"}
              strokeWidth={el.width}
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
      </g>
    </svg>
  );
}

/** แผนที่จักรวาลของเรื่อง — @xyflow/react ผูกกับ locations จริง พอร์ตแนวคิดมาจาก buddybook_demo/
 *  tool_map และขยายเพิ่ม: แปรงระบายภูมิประเทศ, แปรงปั๊มสิ่งกีดขวางต่อเนื่อง, ย่อ/หมุน/พลิก/จัดเลเยอร์
 *  ไอคอน, หมุดผูกฐานข้อมูล (lore link), ประวัติเวอร์ชันแผนที่ และส่งออกเป็นรูปภาพ
 *  ดู wf_map_dm.png (แท็บ Base) — ไม่มีในสคีมาเดิม พอร์ต/ต่อยอดจากฟีดแบ็กผู้ใช้ทั้งหมด
 *  หมายเหตุ — เคยมีตัวเลือกฟอนต์ป้ายชื่อ (แฟนตาซี/ไซไฟ) แต่ถอดออกแล้ว เพราะฟอนต์เหล่านั้นไม่มี
 *  ตัวอักษรไทย จึงไม่มีผลกับป้ายชื่อภาษาไทยที่ใช้จริงในระบบนี้ */
function WorldMapInner({ novelId, initialLocations, initialEdges, initialDrawings, chapters }: WorldMapProps) {
  const { screenToFlowPosition } = useReactFlow();
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
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                ...(patch.scale !== undefined ? { scale: patch.scale } : {}),
                ...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
                ...(patch.flip_x !== undefined ? { flipX: patch.flip_x } : {}),
              },
            }
          : n
      )
    );
    fetch(`/api/v1/locations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
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

  const callbacksRef = useRef({ onRename: renameLocation, onTransform: transformLocation, onLayerOrder: layerOrderLocation, onOpenLore: openLore });
  callbacksRef.current = { onRename: renameLocation, onTransform: transformLocation, onLayerOrder: layerOrderLocation, onOpenLore: openLore };

  const [nodes, setNodes] = useNodesState(
    initialLocations.filter(isPlaced).map((l) => toFlowNode(l, l.pos_x as number, l.pos_y as number, callbacksRef.current))
  );
  const [tray, setTray] = useState<LocationRecord[]>(initialLocations.filter((l) => !isPlaced(l)));
  const [edges, setEdges] = useEdgesState(initialEdges);
  const [placeCount, setPlaceCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDeleteEdgeId, setConfirmDeleteEdgeId] = useState<string | null>(null);

  // โหมดเครื่องมือ: จัดการ / วาดเส้นอิสระ / ระบายภูมิประเทศ (Land Tool) / ปั๊มสิ่งกีดขวาง
  const [mode, setMode] = useState<"manage" | "line" | "fill" | "stamp">("manage");
  const [lineWidth, setLineWidth] = useState(3);
  const [terrainColor, setTerrainColor] = useState(TERRAIN_PRESETS[0].color);
  const [stampIcon, setStampIcon] = useState(STAMP_OPTIONS[0].key);
  // Land Tool — เพิ่มภายหลัง (audit fix) ปรับโหมด "fill" เดิม (ลากปิดรูปทรงตรง ๆ) ให้เป็นแปรงเพิ่ม/
  // ลบพื้นที่ดินแบบ Inkarnate แต่ตัดฟีเจอร์ freeform raster masking ออกเพื่อไม่ให้เว็บหนัก (ดูรายละเอียด
  // ที่คุยกับผู้ใช้แล้ว) — ข้อมูลเก่า kind="fill" ยังเรนเดอร์ได้ปกติ แค่ stroke ใหม่ทั้งหมดเป็น kind="land"
  const [landActionMode, setLandActionMode] = useState<"add" | "subtract">("add");
  const [brushSize, setBrushSize] = useState(40);
  const [roughness, setRoughness] = useState(0);
  const [smoothLand, setSmoothLand] = useState(true);
  const [elements, setElements] = useState<MapElement[]>(initialDrawings);
  // เพิ่มภายหลัง (audit fix) — ปุ่มย้อนกลับ/ทำซ้ำ (Undo/Redo) แบบ Inkarnate ครอบคลุมเฉพาะองค์ประกอบ
  // ที่วาดอิสระ (เส้น/Land Tool/สแตมป์/ล้างทั้งหมด) เก็บ history เป็น index-pointer เข้า snapshot
  // ทั้งชุด ไม่รวมการย้าย/เปลี่ยนชื่อหมุดสถานที่ (ผูกกับ DB จริงแยกต่างหากอยู่แล้วผ่าน renameLocation/
  // transformLocation) — ใช้ ref เก็บค่าล่าสุดกันปัญหา closure ค้างตอนวาดสแตมป์ต่อเนื่องเร็ว ๆ
  const elementsRef = useRef(elements);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);
  const [history, setHistory] = useState<{ stack: MapElement[][]; index: number }>({ stack: [initialDrawings], index: 0 });
  const [activeStroke, setActiveStroke] = useState<ActiveStroke | null>(null);
  const lastStampPosRef = useRef<{ x: number; y: number } | null>(null);
  const isStampingRef = useRef(false);

  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<{ version_id: string; created_at: string }[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [exporting, setExporting] = useState(false);

  function saveElements(next: MapElement[]) {
    fetch(`/api/v1/novels/${novelId}/map-drawings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
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

  async function addLocation({ name, icon, category }: { name: string; icon: LocationIconKey; category?: string }) {
    const res = await fetch(`/api/v1/novels/${novelId}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, map_icon_url: icon, category }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error("create failed");
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

  function handlePointerDown(e: React.PointerEvent) {
    if (mode === "line") {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setActiveStroke({ kind: "line", points: [pos], width: lineWidth });
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (mode === "fill") {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setActiveStroke({ kind: "land", points: [pos], color: terrainColor, brushSize, landMode: landActionMode });
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (mode === "stamp") {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      isStampingRef.current = true;
      lastStampPosRef.current = pos;
      const el: MapElement = { id: `stamp-${Date.now()}`, kind: "stamp", icon: stampIcon, x: pos.x, y: pos.y };
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
    if ((mode === "line" || mode === "fill") && activeStroke) {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setActiveStroke((prev) => (prev ? { ...prev, points: [...prev.points, pos] } : null));
    } else if (mode === "stamp" && isStampingRef.current) {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (!lastStampPosRef.current || distance(lastStampPosRef.current, pos) >= MIN_STAMP_SPACING) {
        lastStampPosRef.current = pos;
        const el: MapElement = { id: `stamp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind: "stamp", icon: stampIcon, x: pos.x, y: pos.y };
        setElements((prev) => {
          const next = [...prev, el];
          saveElements(next);
          return next;
        });
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if ((mode === "line" || mode === "fill") && activeStroke) {
      let el: MapElement;
      if (activeStroke.kind === "land") {
        // ปรับความขรุขระ/ความเรียบครั้งเดียวตอนปล่อยเมาส์เท่านั้น (ไม่ใช่ทุก frame ตอนลาก) กันเว็บหนัก
        let finalPoints = activeStroke.points;
        if (roughness > 0) finalPoints = jitterPoints(finalPoints, roughness);
        if (smoothLand) finalPoints = smoothPoints(finalPoints);
        el = {
          id: `land-${Date.now()}`,
          kind: "land",
          points: finalPoints,
          brushSize: activeStroke.brushSize,
          mode: activeStroke.landMode,
          color: activeStroke.color,
        };
      } else {
        el = { id: `line-${Date.now()}`, kind: "line", points: activeStroke.points, width: activeStroke.width };
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
    commitElements([]);
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
      await fetch(`/api/v1/novels/${novelId}/map-versions`, { method: "POST" });
    } finally {
      setSavingVersion(false);
    }
  }

  async function restoreVersion(versionId: string) {
    await fetch(`/api/v1/map-versions/${versionId}/restore`, { method: "POST" });
    window.location.reload();
  }

  async function exportAsImage() {
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const target = canvasWrapperRef.current;
      if (!target) return;
      const dataUrl = await toPng(target, { backgroundColor: "#fafaf9", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `map-${novelId}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // ส่งออกไม่สำเร็จ — เงียบไว้ ผู้ใช้ลองกดใหม่ได้
    } finally {
      setExporting(false);
    }
  }

  const loreLocation = loreLocationId
    ? { id: loreLocationId, name: nodes.find((n) => n.id === loreLocationId)?.data.name as string | undefined, meta: locationMetaRef.current.get(loreLocationId) }
    : null;

  const modeInstructions: Record<typeof mode, string> = {
    manage:
      "ลากสถานที่เพื่อจัดตำแหน่ง หรือลากจากจุดกลมรอบไอคอน (บน/ขวา/ล่าง/ซ้าย) ไปยังอีกสถานที่เพื่อสร้างเส้นทาง — ดับเบิลคลิกชื่อเพื่อแก้ไข — เลือกไอคอนเพื่อย่อ/หมุน/พลิก/จัดเลเยอร์/เปิดเนื้อหาเรื่องราว — กดที่เส้นทางเพื่อลบ",
    line: 'ลากเมาส์บนแผนที่เพื่อวาดเส้นอิสระ เช่น ชายฝั่งหรือเขตแดน — กด "จัดการ" เพื่อกลับไปแก้ไขสถานที่',
    fill: 'เลือกโหมด "เพิ่ม" หรือ "ลบ" แล้วลากเมาส์เพื่อระบายพื้นที่ดินด้วยแปรง — ปรับขนาดแปรง/ความขรุขระ/ขอบเรียบ และเลือกสีภูมิประเทศได้ด้านบนก่อนวาด',
    stamp: "เลือกไอคอนสิ่งกีดขวางด้านบน แล้วคลิกหรือลากบนแผนที่เพื่อวางต่อเนื่อง เช่น แนวเทือกเขาหรือแนวต้นไม้",
  };

  return (
    <div>
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
              const IconComponent = LOCATION_ICONS[l.icon] ?? MapPinned;
              return (
                <button
                  key={l.location_id}
                  type="button"
                  onClick={() => placeLocation(l)}
                  title={`กดเพื่อวาง ${l.name} บนแผนที่`}
                  className="flex w-20 flex-col items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-white"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-tan/30">
                    <IconComponent className="h-6 w-6 text-brand-tan-dark" />
                  </div>
                  <span className="max-w-full truncate text-xs text-neutral-600">{l.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-800">แผนที่</p>

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
          <button type="button" onClick={saveVersion} disabled={savingVersion} className="flex h-8 items-center gap-1.5 rounded-pill border border-neutral-300 px-3 text-xs font-medium text-neutral-600 hover:border-primary-400 hover:text-primary-500 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> บันทึกเวอร์ชัน
          </button>
          <button type="button" onClick={openVersionsPanel} className="flex h-8 items-center gap-1.5 rounded-pill border border-neutral-300 px-3 text-xs font-medium text-neutral-600 hover:border-primary-400 hover:text-primary-500">
            <History className="h-3.5 w-3.5" /> ประวัติเวอร์ชัน
          </button>
          <button type="button" onClick={exportAsImage} disabled={exporting} className="flex h-8 items-center gap-1.5 rounded-pill border border-neutral-300 px-3 text-xs font-medium text-neutral-600 hover:border-primary-400 hover:text-primary-500 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> {exporting ? "กำลังส่งออก..." : "ส่งออกรูปภาพ"}
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full bg-neutral-100 p-0.5">
          <button type="button" onClick={() => setMode("manage")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "manage" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}>
            <Hand className="h-3.5 w-3.5" /> จัดการ
          </button>
          <button type="button" onClick={() => setMode("line")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "line" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}>
            <Pencil className="h-3.5 w-3.5" /> วาดเส้น
          </button>
          <button type="button" onClick={() => setMode("fill")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "fill" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}>
            <PaintBucket className="h-3.5 w-3.5" /> ระบายภูมิประเทศ
          </button>
          <button type="button" onClick={() => setMode("stamp")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "stamp" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}>
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

        {mode === "fill" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {TERRAIN_PRESETS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  title={t.label}
                  onClick={() => setTerrainColor(t.color)}
                  className="h-6 w-6 rounded-full transition hover:scale-110"
                  style={{ background: t.color, outline: terrainColor === t.color ? `2px solid ${t.color}` : "none", outlineOffset: "2px" }}
                />
              ))}
            </div>

            <div className="flex items-center rounded-full bg-neutral-100 p-0.5">
              <button
                type="button"
                onClick={() => setLandActionMode("add")}
                className={cn("rounded-full px-3 py-1 text-xs font-medium transition", landActionMode === "add" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}
              >
                + เพิ่ม
              </button>
              <button
                type="button"
                onClick={() => setLandActionMode("subtract")}
                className={cn("rounded-full px-3 py-1 text-xs font-medium transition", landActionMode === "subtract" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}
              >
                − ลบ
              </button>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
              ขนาดแปรง
              <input type="range" min={10} max={100} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="accent-primary-500" />
              <span className="w-6 text-neutral-600">{brushSize}</span>
            </label>

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
        )}

        {mode === "stamp" && (
          <div className="flex items-center gap-1.5">
            {STAMP_OPTIONS.map((s) => {
              const StampIconComp = STAMP_ICONS[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  title={s.label}
                  onClick={() => setStampIcon(s.key)}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", stampIcon === s.key ? "border-primary-500 bg-primary-50" : "border-neutral-300 hover:bg-neutral-50")}
                >
                  <StampIconComp className="h-4 w-4 text-neutral-600" />
                </button>
              );
            })}
          </div>
        )}

        {mode !== "manage" && elements.length > 0 && (
          <button type="button" onClick={clearElements} className="text-xs text-red-500 underline">
            ล้างองค์ประกอบที่วาด
          </button>
        )}
      </div>

      <div ref={canvasWrapperRef} className="relative h-96 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          panOnDrag={mode === "manage"}
          nodesDraggable={mode === "manage"}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <DrawingLayer elements={elements} activeStroke={activeStroke} />
          <Background gap={16} color="#e5e7eb" />
          <Controls showInteractive={false} />
        </ReactFlow>

        {mode !== "manage" && (
          <div
            className="absolute inset-0 touch-none"
            style={{ zIndex: 50, cursor: mode === "stamp" ? "copy" : "crosshair" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        )}
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
                    <span className="text-neutral-600">{new Date(v.created_at).toLocaleString("th-TH")}</span>
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
