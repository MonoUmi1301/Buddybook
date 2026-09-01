"use client";

import { useCallback, useState } from "react";
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
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Trash2, UserRoundPlus, X } from "lucide-react";
import { CharacterNode, type CharacterNodeData } from "@/components/writer/CharacterNode";
import { AddCharacterModal } from "@/components/writer/AddCharacterModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const nodeTypes = { characterNode: CharacterNode };

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

export interface CharacterRecord {
  node_id: string;
  name: string;
  avatar_url?: string;
  position_x: number | null;
  position_y: number | null;
}

interface CharacterGraphProps {
  novelId: string;
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

function toFlowNode(c: CharacterRecord, x: number, y: number): Node<CharacterNodeData> {
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
export function CharacterGraph({ novelId, initialCharacters, initialEdges }: CharacterGraphProps) {
  const [nodes, setNodes] = useNodesState(
    initialCharacters
      .filter(isPlaced)
      .map((c) => toFlowNode(c, c.position_x as number, c.position_y as number))
  );
  const [tray, setTray] = useState<CharacterRecord[]>(initialCharacters.filter((c) => !isPlaced(c)));
  const [edges, setEdges] = useEdgesState(initialEdges);
  const [placeCount, setPlaceCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEdge, setEditingEdge] = useState<{ id: string; label: string; edgeType: EdgeLineType } | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<CharacterNodeData>>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      for (const change of changes) {
        if (change.type === "remove") {
          fetch(`/api/v1/characters/${change.id}`, { method: "DELETE" }).catch(() => {});
        }
      }
    },
    [setNodes]
  );

  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    fetch(`/api/v1/characters/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position_x: node.position.x, position_y: node.position.y }),
    }).catch(() => {});
  }, []);

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      for (const change of changes) {
        if (change.type === "remove") {
          fetch(`/api/v1/character-edges/${change.id}`, { method: "DELETE" }).catch(() => {});
        }
      }
    },
    [setEdges]
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
          }),
        });
        const json = await res.json();
        if (!res.ok) return;
        setEdges((eds) => addEdge({ ...connection, id: json.edge_id, style: { stroke: "#94a3b8" } }, eds));
      } catch {
        // เชื่อมต่อไม่สำเร็จ — ไม่เพิ่มเส้นใน canvas
      }
    },
    [novelId, setEdges]
  );

  const onEdgeClick = useCallback((_event: unknown, edge: Edge) => {
    setEditingEdge({
      id: edge.id,
      label: typeof edge.label === "string" ? edge.label : "",
      edgeType: isEdgeLineType(edge.type) ? edge.type : "default",
    });
  }, []);

  async function saveEdgeLabel() {
    if (!editingEdge) return;
    const id = editingEdge.id;
    const label = editingEdge.label.trim();
    const edgeType = editingEdge.edgeType;
    try {
      await fetch(`/api/v1/character-edges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edge_label: label, edge_type: edgeType }),
      });
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label: label || undefined, type: edgeType } : e)));
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
    fetch(`/api/v1/character-edges/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function addCharacter({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
    const res = await fetch(`/api/v1/novels/${novelId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_name: name, avatar_url: avatarUrl }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error("create failed");
    setTray((t) => [...t, { node_id: json.node_id, name, avatar_url: avatarUrl, position_x: null, position_y: null }]);
  }

  async function placeCharacter(character: CharacterRecord) {
    const col = placeCount % 4;
    const row = Math.floor(placeCount / 4);
    const position = { x: 60 + col * 140, y: 60 + row * 140 };
    setPlaceCount((n) => n + 1);
    setTray((t) => t.filter((c) => c.node_id !== character.node_id));
    setNodes((nds) => [...nds, toFlowNode(character, position.x, position.y)]);
    fetch(`/api/v1/characters/${character.node_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position_x: position.x, position_y: position.y }),
    }).catch(() => {});
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
              ยังไม่มีตัวละครรอวาง — กด &quot;เพิ่มตัวละคร&quot; แล้วกดที่ตัวละครเพื่อวางลงบนแคนวาสด้านล่าง
            </p>
          ) : (
            tray.map((c) => (
              <button
                key={c.node_id}
                type="button"
                onClick={() => placeCharacter(c)}
                title={`กดเพื่อวาง ${c.name} บนแคนวาส`}
                className="flex w-20 flex-col items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-white"
              >
                <Avatar src={c.avatar_url} alt={c.name} size="lg" />
                <span className="max-w-full truncate text-xs text-neutral-600">{c.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <p className="mb-2 text-sm font-semibold text-neutral-800">แผนภาพความสัมพันธ์ของตัวละคร</p>

      <div className="h-96 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
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
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} color="#e5e7eb" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <p className="mt-3 text-center text-xs text-neutral-400">
        ลากตัวละครเพื่อจัดตำแหน่ง หรือลากจากจุดกลมรอบตัวละคร (บน/ขวา/ล่าง/ซ้าย) ไปยังอีกตัวเพื่อ
        สร้างเส้นความสัมพันธ์ใหม่ — กดที่เส้นเพื่อใส่ข้อความกำกับ — เลือกแล้วกด Delete เพื่อลบ (ย้ายลงถังขยะ)
      </p>

      {showAddModal && <AddCharacterModal onClose={() => setShowAddModal(false)} onSubmit={addCharacter} />}

      {editingEdge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-h3 text-neutral-900">ข้อความกำกับความสัมพันธ์</h2>
              <button
                type="button"
                onClick={() => setEditingEdge(null)}
                aria-label="ปิด"
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <input
              value={editingEdge.label}
              onChange={(e) => setEditingEdge({ ...editingEdge, label: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && saveEdgeLabel()}
              placeholder="เช่น พี่น้อง, คู่รัก, ศัตรูคู่แค้น"
              autoFocus
              className="h-11 w-full rounded-lg border border-neutral-300 px-4 text-sm focus:border-primary-400 focus:outline-none"
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
                <Button type="button" variant="primary" onClick={saveEdgeLabel}>
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
