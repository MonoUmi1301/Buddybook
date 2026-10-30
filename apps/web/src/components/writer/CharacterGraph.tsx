"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  MarkerType,
  Position,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Download, Eye, EyeOff, Loader2, Trash2, UserRoundPlus, X } from "lucide-react";
import { CharacterNode, CharacterNodeActionsContext, type CharacterNodeData } from "@/components/writer/CharacterNode";
import { AddCharacterModal } from "@/components/writer/AddCharacterModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/Toaster";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { formatApiError } from "@/lib/formatApiError";
import { handleAsync } from "@/lib/handleAsync";

export const nodeTypes = { characterNode: CharacterNode };

// เพิ่มภายหลัง (audit fix) — ผู้ใช้ขอเลือกรูปแบบเส้นความสัมพันธ์ได้ (ตรง/หักมุม/โค้ง) แทนที่จะเป็น
// เส้นโค้ง bezier ("default") ตายตัวเสมอ ผูกกับคอลัมน์ edge_type ที่มีอยู่แล้วในสคีมาแต่ไม่เคยมี
// UI ตั้งค่าได้จริงมาก่อน
const EDGE_LINE_TYPES = ["default", "straight", "smoothstep"] as const;
type EdgeLineType = (typeof EDGE_LINE_TYPES)[number];
const EDGE_LINE_TYPE_LABEL: Record<EdgeLineType, string> = {
  default: "โค้ง",
  straight: "ตรง",
  smoothstep: "หักมุม",
};
function isEdgeLineType(value: unknown): value is EdgeLineType {
  return typeof value === "string" && (EDGE_LINE_TYPES as readonly string[]).includes(value);
}

// เพิ่มภายหลัง — สีเส้น + หัวลูกศรของเส้นความสัมพันธ์ (เก็บใน edge_style ของ CharacterEdge)
type EdgeArrow = "none" | "end" | "start" | "both";
interface EdgeStyleSetting {
  color: string;
  arrow: EdgeArrow;
}
const DEFAULT_EDGE_STYLE: EdgeStyleSetting = { color: "#94a3b8", arrow: "none" };
const EDGE_COLORS = [
  { value: "#94a3b8", label: "เทา" },
  { value: "#ef4444", label: "แดง (ศัตรู/ขัดแย้ง)" },
  { value: "#ec4899", label: "ชมพู (ความรัก)" },
  { value: "#f97316", label: "ส้ม" },
  { value: "#eab308", label: "เหลือง" },
  { value: "#22c55e", label: "เขียว (มิตรภาพ)" },
  { value: "#3b82f6", label: "น้ำเงิน (ครอบครัว)" },
  { value: "#8b5cf6", label: "ม่วง" },
];
const EDGE_ARROWS: { value: EdgeArrow; label: string }[] = [
  { value: "none", label: "ไม่มี" },
  { value: "end", label: "→" },
  { value: "start", label: "←" },
  { value: "both", label: "↔" },
];

function readEdgeStyle(edge: Edge): EdgeStyleSetting {
  const raw = (edge.data as { edge_style?: Partial<EdgeStyleSetting> } | undefined)?.edge_style;
  const arrow = raw?.arrow;
  return {
    color: typeof raw?.color === "string" ? raw.color : DEFAULT_EDGE_STYLE.color,
    arrow: arrow === "end" || arrow === "start" || arrow === "both" ? arrow : "none",
  };
}

/** แปลงค่าที่ผู้ใช้ตั้ง (สี/ลูกศร) เป็น prop ของ react-flow — end = ชี้จากตัวที่ลากเริ่ม ไปหาตัวปลายทาง */
export function decorateEdge(edge: Edge, setting: EdgeStyleSetting = readEdgeStyle(edge)): Edge {
  const marker = { type: MarkerType.ArrowClosed, color: setting.color, width: 18, height: 18 };
  // ป้ายหลายบรรทัด: SVG <text> ไม่ขึ้นบรรทัดใหม่ให้เอง จึงแตกเป็น <tspan> และเก็บข้อความดิบไว้ใน data.raw_label
  const rawLabel =
    typeof edge.label === "string" ? edge.label : ((edge.data as { raw_label?: string } | undefined)?.raw_label ?? "");
  const lines = rawLabel.split("\n");
  const label =
    lines.length > 1 ? (
      <>
        {lines.map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : "1.2em"}>
            {line}
          </tspan>
        ))}
      </>
    ) : (
      edge.label
    );
  return {
    ...edge,
    label,
    data: { ...(edge.data ?? {}), edge_style: setting, raw_label: rawLabel },
    style: { stroke: setting.color, strokeWidth: 2 },
    // ใส่สี/ขนาดตรง ๆ (ไม่พึ่ง CSS variable) — ไม่งั้นตอนดาวน์โหลดรูป พื้นหลังป้ายจะกลายเป็นสีดำ
    labelStyle: { fill: "#334155", fontSize: 12, fontWeight: 500, fontFamily: "inherit" },
    labelShowBg: true,
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95, stroke: setting.color, strokeWidth: 1 },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
    markerEnd: setting.arrow === "end" || setting.arrow === "both" ? marker : undefined,
    markerStart: setting.arrow === "start" || setting.arrow === "both" ? marker : undefined,
  };
}

export interface CharacterRecord {
  node_id: string;
  name: string;
  avatar_url?: string;
  position_x: number | null;
  position_y: number | null;
}

interface CharacterGraphProps {
  novelId: string;
  /** เวลาที่เผยแพร่แผนผังบนหน้านิยายล่าสุด (null = ไม่ได้แสดงบนหน้านิยาย) */
  initialPublishedAt?: string | null;
  initialCharacters: CharacterRecord[];
  initialEdges: Edge[];
}

// เพิ่มภายหลัง (audit fix) — @xyflow/react ต้องรู้ตำแหน่ง handle ของ node ก่อนถึงจะวาดเส้น edge
// ได้ (internals.handleBounds) ปกติมันวัดเองผ่าน ResizeObserver แบบ async แต่ในเคสนี้เอฟเฟกต์
// วัดขนาดไม่เคยยิงเลย (ตรวจสอบแล้วว่า onNodesChange ไม่ได้รับ NodeChange type "dimensions"
// เข้ามาเลยสักครั้ง) ทำให้เส้นความสัมพันธ์ไม่เคยขึ้นแม้ข้อมูล edge จาก backend จะถูกต้องครบทุก
// อย่างก็ตาม — แก้โดยระบุตำแหน่ง handle ตายตัวไว้ล่วงหน้าแทน
// เพิ่มภายหลัง (audit fix) — ผู้ใช้ขอให้ลากเส้นความสัมพันธ์ได้รอบวงกลม ไม่ใช่แค่บน/ล่าง จึงเพิ่ม
// เป็น 4 ทิศ (บน/ขวา/ล่าง/ซ้าย) ทุกจุดเป็น source ทั้งหมด คู่กับ connectionMode="loose" ด้านล่าง
// (ให้ลากจากจุดไหนไปจุดไหนก็ได้ ไม่ต้องแยก source/target ตายตัวเหมือนเดิม)
const CHARACTER_NODE_WIDTH = 80;
const CHARACTER_NODE_HEIGHT = 90;
const CHARACTER_HANDLE_MID_Y = CHARACTER_NODE_HEIGHT / 2;

export function toFlowNode(c: CharacterRecord, x: number, y: number): Node<CharacterNodeData> {
  return {
    id: c.node_id,
    type: "characterNode",
    position: { x, y },
    data: { name: c.name, avatarUrl: c.avatar_url },
    width: CHARACTER_NODE_WIDTH,
    height: CHARACTER_NODE_HEIGHT,
    handles: [
      { id: "top", type: "source", position: Position.Top, x: CHARACTER_NODE_WIDTH / 2, y: 0 },
      { id: "right", type: "source", position: Position.Right, x: CHARACTER_NODE_WIDTH, y: CHARACTER_HANDLE_MID_Y },
      { id: "bottom", type: "source", position: Position.Bottom, x: CHARACTER_NODE_WIDTH / 2, y: CHARACTER_NODE_HEIGHT },
      { id: "left", type: "source", position: Position.Left, x: 0, y: CHARACTER_HANDLE_MID_Y },
    ],
  };
}

/** เส้นเก่าที่สร้างก่อนมีการบันทึกจุดต่อ (sourceHandle/targetHandle ว่าง) — react-flow หาจุดต่อไม่เจอ
 *  ("Couldn't create edge for target handle id: null") และย้ายปลายเส้นไม่ได้ เลือกจุดต่อให้จากตำแหน่ง
 *  ตัวละครแทน: อยู่ห่างกันแนวนอนมากกว่า = ขวา/ซ้าย, แนวตั้งมากกว่า = ล่าง/บน */
export function withDefaultHandles(edge: Edge, characters: CharacterRecord[]): Edge {
  if (edge.sourceHandle && edge.targetHandle) return edge;
  const src = characters.find((c) => c.node_id === edge.source);
  const tgt = characters.find((c) => c.node_id === edge.target);
  const dx = (tgt?.position_x ?? 0) - (src?.position_x ?? 0);
  const dy = (tgt?.position_y ?? 0) - (src?.position_y ?? 0);
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const sourceSide = horizontal ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "bottom" : "top";
  const opposite: Record<string, string> = { right: "left", left: "right", bottom: "top", top: "bottom" };
  return {
    ...edge,
    sourceHandle: edge.sourceHandle || sourceSide,
    targetHandle: edge.targetHandle || opposite[sourceSide],
  };
}

function isPlaced(c: CharacterRecord): boolean {
  return c.position_x !== null && c.position_y !== null;
}

/**
 * แผนภาพความสัมพันธ์ตัวละคร (world-building) ใช้ @xyflow/react ตามที่ระบุใน
 * BuddyBook_System_Architecture.md — ทุกการเปลี่ยนแปลง (เพิ่ม/ลาก/ลบ node, ลากเชื่อม/ลบ edge)
 * ยิง POST/PATCH/DELETE จริงทันที ไม่มีปุ่ม "บันทึก" แยกต่างหาก ดู wf_map_dm.png
 *
 * เพิ่มภายหลัง (audit fix) — ตัวละครที่สร้างใหม่จะไม่ถูกวางบนแคนวาสทันทีอีกต่อไป แต่ไปอยู่ใน
 * แถบ "ตัวละครที่รอวาง" ก่อน ต้องกดเลือกถึงจะถูกวาง (position_x/y เดิม null → ได้ตำแหน่งจริง)
 * ตามที่ผู้ใช้ระบุ — ดู novels.service.ts getWorldBuilding ฝั่ง backend คู่กัน
 */
export function CharacterGraph({ novelId, initialCharacters, initialEdges, initialPublishedAt = null }: CharacterGraphProps) {
  // เพิ่มภายหลัง — ดาวน์โหลดแผนภาพเป็นรูป + เผยแพร่/ซ่อนบนหน้านิยาย (ผู้อ่านเห็นสำเนา ณ ตอนที่กด กันสปอยล์)
  const canvasRef = useRef<HTMLDivElement>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(initialPublishedAt);
  const [busy, setBusy] = useState<"download" | "publish" | "unpublish" | null>(null);
  // แผนผังบนหน้านิยายเป็น "สำเนา ณ ตอนกดเผยแพร่" — แก้อะไรหลังจากนั้น ผู้อ่านยังไม่เห็นจนกว่าจะกดอัปเดต
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);

  async function downloadImage() {
    if (!canvasRef.current) return;
    setBusy("download");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(canvasRef.current, {
        backgroundColor: "#fafafa",
        pixelRatio: 2,
        // ไม่เอาปุ่มซูม (+/−) ติดไปในรูป
        filter: (node) =>
          !(
            node instanceof HTMLElement &&
            (node.classList.contains("react-flow__controls") || node.classList.contains("character-node-delete"))
          ),
      });
      const link = document.createElement("a");
      link.download = `character-map-${novelId}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast("บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  async function publishMap() {
    setBusy("publish");
    try {
      const res = await fetch(`/api/v1/novels/${novelId}/character-map`, { method: "PUT" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast(formatApiError(json, "เผยแพร่แผนผังไม่สำเร็จ"));
        return;
      }
      setPublishedAt(json.character_map_published_at);
      setDirty(false);
      toast(`เผยแพร่บนหน้านิยายแล้ว — ตัวละคร ${json.character_count} ตัว, เส้นความสัมพันธ์ ${json.edge_count} เส้น`);
    } catch {
      toast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  async function unpublishMap() {
    setBusy("unpublish");
    try {
      const res = await fetch(`/api/v1/novels/${novelId}/character-map`, { method: "DELETE" });
      if (!res.ok) {
        toast("ซ่อนแผนผังไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
      setPublishedAt(null);
      toast("ซ่อนแผนผังจากหน้านิยายแล้ว");
    } catch {
      toast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  const [nodes, setNodes] = useNodesState(
    initialCharacters
      .filter(isPlaced)
      .map((c) => toFlowNode(c, c.position_x as number, c.position_y as number))
  );
  const [tray, setTray] = useState<CharacterRecord[]>(initialCharacters.filter((c) => !isPlaced(c)));
  const [edges, setEdges] = useEdgesState(
    initialEdges.map((e) => decorateEdge(withDefaultHandles(e, initialCharacters)))
  );
  const [placeCount, setPlaceCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEdge, setEditingEdge] = useState<{
    id: string;
    label: string;
    edgeType: EdgeLineType;
    color: string;
    arrow: EdgeArrow;
  } | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<CharacterNodeData>>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      for (const change of changes) {
        if (change.type === "remove") {
          markDirty();
          fetch(`/api/v1/characters/${change.id}`, { method: "DELETE" }).catch(() => {});
        }
      }
    },
    [setNodes, markDirty]
  );

  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    markDirty();
    fetch(`/api/v1/characters/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position_x: node.position.x, position_y: node.position.y }),
    }).catch(() => {});
  }, [markDirty]);

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      for (const change of changes) {
        if (change.type === "remove") {
          markDirty();
          fetch(`/api/v1/character-edges/${change.id}`, { method: "DELETE" }).catch(() => {});
        }
      }
    },
    [setEdges, markDirty]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      try {
        const res = await fetch(`/api/v1/novels/${novelId}/character-edges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_node_id: connection.source,
            target_node_id: connection.target,
            // บันทึกจุดต่อเส้น (บน/ขวา/ล่าง/ซ้าย) ไว้ด้วย รีเฟรชแล้วเส้นจะอยู่จุดเดิม
            source_handle: connection.sourceHandle ?? undefined,
            target_handle: connection.targetHandle ?? undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) return;
        setEdges((eds) => addEdge(decorateEdge({ ...connection, id: json.edge_id } as Edge, DEFAULT_EDGE_STYLE), eds));
        markDirty();
      } catch {
        // เชื่อมต่อไม่สำเร็จ — ไม่เพิ่มเส้นใน canvas
      }
    },
    [novelId, setEdges, markDirty]
  );

  // เพิ่มภายหลัง — ลากปลายเส้นความสัมพันธ์ที่มีอยู่ไปต่อจุดใหม่/ตัวละครใหม่ได้เลย ไม่ต้องลบแล้วลากใหม่
  // (shouldReplaceId: false = คง id เดิมไว้ เพราะ id คือ edge_id ใน DB)
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target || newConnection.source === newConnection.target) return;
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds, { shouldReplaceId: false }));
      markDirty();
      fetch(`/api/v1/character-edges/${oldEdge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_node_id: newConnection.source,
          target_node_id: newConnection.target,
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
    [setEdges, markDirty]
  );

  const onEdgeClick = useCallback((_event: unknown, edge: Edge) => {
    const setting = readEdgeStyle(edge);
    setEditingEdge({
      id: edge.id,
      label: (edge.data as { raw_label?: string } | undefined)?.raw_label ?? (typeof edge.label === "string" ? edge.label : ""),
      edgeType: isEdgeLineType(edge.type) ? edge.type : "default",
      color: setting.color,
      arrow: setting.arrow,
    });
  }, []);

  async function saveEdgeLabel() {
    if (!editingEdge) return;
    const id = editingEdge.id;
    const label = editingEdge.label.trim();
    const edgeType = editingEdge.edgeType;
    const edgeStyle: EdgeStyleSetting = { color: editingEdge.color, arrow: editingEdge.arrow };
    try {
      const res = await fetch(`/api/v1/character-edges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edge_label: label, edge_type: edgeType, edge_style: edgeStyle }),
      });
      if (!res.ok) return;
      markDirty();
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? decorateEdge({ ...e, label: label || undefined, type: edgeType }, edgeStyle) : e))
      );
    } catch {
      // บันทึกข้อความกำกับไม่สำเร็จ — เก็บ popover เปิดไว้ให้ลองใหม่
      return;
    }
    setEditingEdge(null);
  }

  function deleteEdgeFromPopup() {
    if (!editingEdge) return;
    const id = editingEdge.id;
    setEdges((eds) => eds.filter((e) => e.id !== id));
    setEditingEdge(null);
    markDirty();
    fetch(`/api/v1/character-edges/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function addCharacter({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
    const res = await fetch(`/api/v1/novels/${novelId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_name: name, avatar_url: avatarUrl }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatApiError(json, "เพิ่มตัวละครไม่สำเร็จ ลองใหม่อีกครั้ง"));
    setTray((t) => [...t, { node_id: json.node_id, name, avatar_url: avatarUrl, position_x: null, position_y: null }]);
  }

  async function placeCharacter(character: CharacterRecord, dropAt?: { x: number; y: number }) {
    let position = dropAt;
    if (!position) {
      const col = placeCount % 4;
      const row = Math.floor(placeCount / 4);
      position = { x: 60 + col * 140, y: 60 + row * 140 };
      setPlaceCount((n) => n + 1);
    }
    setTray((t) => t.filter((c) => c.node_id !== character.node_id));
    setNodes((nds) => [...nds, toFlowNode(character, position.x, position.y)]);
    markDirty();
    fetch(`/api/v1/characters/${character.node_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position_x: position.x, position_y: position.y }),
    }).catch(() => {});
  }

  // ---- ลบตัวละคร (ย้ายลงถังขยะ — backend ลบเส้นที่ต่อกับตัวนี้ไปด้วย) ----
  const [confirm, confirmDialog] = useConfirm();
  const deleteCharacter = useCallback(
    async (nodeId: string, name: string) => {
      const ok = await confirm({
        title: `ลบ "${name}" จริงเหรอ?`,
        message: "เส้นความสัมพันธ์ทั้งหมดของตัวละครนี้จะถูกลบไปด้วย (ย้ายลงถังขยะ กู้คืนได้)",
        confirmText: "ลบเลย",
      });
      if (!ok) return;
      try {
        const res = await fetch(`/api/v1/characters/${nodeId}`, { method: "DELETE" });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          toast(formatApiError(json, "ลบตัวละครไม่สำเร็จ ลองใหม่อีกครั้ง"));
          return;
        }
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        markDirty();
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        setTray((t) => t.filter((c) => c.node_id !== nodeId));
        toast(`ย้าย "${name}" ลงถังขยะแล้ว`);
      } catch {
        toast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      }
    },
    [confirm, setNodes, setEdges, markDirty]
  );
  const nodeActions = useMemo(() => ({ onDelete: deleteCharacter }), [deleteCharacter]);

  // ---- ลากตัวละครจากแถบ "รอวาง" มาปล่อยบนแคนวาส ----
  const [flow, setFlow] = useState<ReactFlowInstance<Node<CharacterNodeData>, Edge> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const DRAG_TYPE = "application/x-buddybook-character";

  function onCanvasDragOver(e: DragEvent) {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragOver) setDragOver(true);
  }

  function onCanvasDrop(e: DragEvent) {
    setDragOver(false);
    const nodeId = e.dataTransfer.getData(DRAG_TYPE);
    const character = tray.find((c) => c.node_id === nodeId);
    if (!character || !flow) return;
    e.preventDefault();
    const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // ให้กลางรูปตัวละครอยู่ตรงเมาส์
    void placeCharacter(character, {
      x: Math.round(p.x - CHARACTER_NODE_WIDTH / 2),
      y: Math.round(p.y - 28),
    });
  }

  return (
    <div>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-800">ตัวละครที่รอวาง</p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-pill border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-primary-400 hover:text-primary-500"
          >
            <UserRoundPlus className="h-4 w-4" />
            เพิ่มตัวละคร
          </button>
        </div>
        <div className="flex min-h-[5.5rem] flex-wrap items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
          {tray.length === 0 ? (
            <p className="mx-auto text-xs text-neutral-400">
              ยังไม่มีตัวละครรอวาง — กด &quot;เพิ่มตัวละคร&quot; แล้วกดหรือลากตัวละครไปวางบนแคนวาสด้านล่าง
            </p>
          ) : (
            tray.map((c) => (
              <div key={c.node_id} className="group relative">
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, c.node_id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDragOver(false)}
                  onClick={handleAsync(() => placeCharacter(c))}
                  title={`กดหรือลาก ${c.name} ไปวางบนแคนวาส`}
                  className="flex w-20 cursor-grab flex-col items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-white active:cursor-grabbing"
                >
                  <Avatar src={c.avatar_url} alt={c.name} size="lg" />
                  <span className="max-w-full truncate text-xs text-neutral-600">{c.name}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAsync(() => deleteCharacter(c.node_id, c.name))}
                  title={`ลบ ${c.name}`}
                  aria-label={`ลบ ${c.name}`}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow transition-opacity hover:bg-red-600 focus:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-800">แผนภาพความสัมพันธ์ของตัวละคร</p>
          {publishedAt && dirty && (
            <p className="text-xs font-medium text-amber-600">
              มีการแก้ไขที่ผู้อ่านยังไม่เห็น — กด &quot;อัปเดตบนหน้านิยาย&quot; เพื่อให้แผนผังบนหน้านิยายตรงกับตอนนี้
            </p>
          )}
          <p className="text-xs text-neutral-400">
            {publishedAt
              ? `แสดงบนหน้านิยายแล้ว (ฉบับวันที่ ${new Date(publishedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}) — แก้แผนภาพแล้วกด "อัปเดต" ผู้อ่านถึงจะเห็นฉบับใหม่`
              : "ยังไม่แสดงบนหน้านิยาย — ผู้อ่านจะเห็นเฉพาะเมื่อกดเผยแพร่"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAsync(downloadImage)}
            disabled={busy !== null}
            className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-neutral-300 px-3 text-xs font-medium text-neutral-600 hover:border-primary-400 hover:text-primary-500 disabled:opacity-50"
          >
            {busy === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            ดาวน์โหลดรูป
          </button>
          <button
            type="button"
            onClick={handleAsync(publishMap)}
            disabled={busy !== null}
            className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-primary-500 px-3 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {busy === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            {publishedAt ? "อัปเดตบนหน้านิยาย" : "แสดงบนหน้านิยาย"}
          </button>
          {publishedAt && (
            <button
              type="button"
              onClick={handleAsync(unpublishMap)}
              disabled={busy !== null}
              className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-neutral-300 px-3 text-xs font-medium text-neutral-600 hover:border-red-300 hover:text-red-500 disabled:opacity-50"
            >
              {busy === "unpublish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
              ซ่อน
            </button>
          )}
        </div>
      </div>

      <CharacterNodeActionsContext.Provider value={nodeActions}>
      <div
        ref={canvasRef}
        onDragOver={onCanvasDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setDragOver(false);
        }}
        onDrop={onCanvasDrop}
        className={cn(
          "h-96 overflow-hidden rounded-lg border bg-neutral-50 transition-colors",
          dragOver ? "border-2 border-dashed border-primary-400 bg-primary-50/40" : "border-neutral-200"
        )}
      >
        <ReactFlow
          onInit={setFlow}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={handleAsync(onConnect)}
          onReconnect={onReconnect}
          edgesReconnectable
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} color="#e5e7eb" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      </CharacterNodeActionsContext.Provider>

      <p className="mt-3 text-center text-xs text-neutral-400">
        ลากตัวละครเพื่อจัดตำแหน่ง หรือลากจากจุดกลมรอบตัวละคร (บน/ขวา/ล่าง/ซ้าย) ไปยังอีกตัวเพื่อ
        สร้างเส้นความสัมพันธ์ใหม่ — ลากปลายเส้นเพื่อย้ายจุดต่อ — กดที่เส้นเพื่อใส่ข้อความ เปลี่ยนสี หรือเพิ่มหัวลูกศร — ชี้ที่ตัวละครแล้วกดปุ่ม ✕ สีแดงเพื่อลบตัวละคร (ย้ายลงถังขยะ)
      </p>

      {confirmDialog}

      {showAddModal && <AddCharacterModal onClose={() => setShowAddModal(false)} onSubmit={addCharacter} />}

      {editingEdge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-h3 text-neutral-900">ตั้งค่าเส้นความสัมพันธ์</h2>
              <button
                type="button"
                onClick={() => setEditingEdge(null)}
                aria-label="ปิด"
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <textarea
              value={editingEdge.label}
              maxLength={100}
              rows={2}
              onChange={(e) => setEditingEdge({ ...editingEdge, label: e.target.value })}
              onKeyDown={(e) => {
                // เดสก์ท็อป: Enter = บันทึก, Shift+Enter = ขึ้นบรรทัดใหม่
                // มือถือ/แท็บเล็ต (จอสัมผัส): ปุ่ม return บนคีย์บอร์ด = ขึ้นบรรทัดใหม่ แล้วกดปุ่มบันทึกแทน
                if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                if (window.matchMedia("(pointer: coarse)").matches) return;
                e.preventDefault();
                void saveEdgeLabel();
              }}
              placeholder="เช่น พี่น้อง, คู่รัก, ศัตรูคู่แค้น"
              autoFocus
              className="w-full resize-none rounded-lg border border-neutral-300 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none"
            />

            <p className="mb-1.5 mt-3 text-xs font-medium text-neutral-500">รูปแบบเส้น</p>
            <div className="flex gap-2">
              {EDGE_LINE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEditingEdge({ ...editingEdge, edgeType: t })}
                  className={cn(
                    "rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors",
                    editingEdge.edgeType === t
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  {EDGE_LINE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            <p className="mb-1.5 mt-3 text-xs font-medium text-neutral-500">สีเส้น</p>
            <div className="flex flex-wrap gap-2">
              {EDGE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  aria-label={`สี${c.label}`}
                  onClick={() => setEditingEdge({ ...editingEdge, color: c.value })}
                  className={cn(
                    "h-7 w-7 rounded-full ring-2 ring-offset-2 transition",
                    editingEdge.color === c.value ? "ring-neutral-700" : "ring-transparent hover:ring-neutral-300"
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>

            <p className="mb-1.5 mt-3 text-xs font-medium text-neutral-500">หัวลูกศร</p>
            <div className="flex gap-2">
              {EDGE_ARROWS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setEditingEdge({ ...editingEdge, arrow: a.value })}
                  className={cn(
                    "min-w-10 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors",
                    editingEdge.arrow === a.value
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">→ = ชี้จากตัวที่ลากเส้นเริ่ม ไปยังอีกตัว</p>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={deleteEdgeFromPopup}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> ลบเส้นความสัมพันธ์
              </button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingEdge(null)}>
                  ยกเลิก
                </Button>
                <Button type="button" variant="primary" onClick={handleAsync(saveEdgeLabel)}>
                  บันทึก
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
