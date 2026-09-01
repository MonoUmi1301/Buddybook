"use client";

import { useState } from "react";
import { Handle, NodeToolbar, Position, type NodeProps } from "@xyflow/react";
import {
  Castle,
  Home,
  Trees,
  Skull,
  Waves,
  Flame,
  Store,
  Landmark,
  MapPinned,
  BookOpen,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  ChevronsUp,
  ChevronsDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type LocationIconKey =
  | "castle"
  | "village"
  | "forest"
  | "dungeon"
  | "lake"
  | "volcano"
  | "market"
  | "shrine";

export const LOCATION_ICONS: Record<LocationIconKey, LucideIcon> = {
  castle: Castle,
  village: Home,
  forest: Trees,
  dungeon: Skull,
  lake: Waves,
  volcano: Flame,
  market: Store,
  shrine: Landmark,
};

export interface LocationNodeData {
  name: string;
  icon?: string;
  scale?: number;
  rotation?: number;
  flipX?: boolean;
  onRename?: (nodeId: string, newName: string) => void;
  onTransform?: (nodeId: string, patch: { scale?: number; rotation?: number; flip_x?: boolean }) => void;
  onLayerOrder?: (nodeId: string, direction: "front" | "back") => void;
  onOpenLore?: (nodeId: string) => void;
  [key: string]: unknown;
}

const iconBtnClass =
  "flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200";

/** Node แผนที่จักรวาล — ไอคอนสถานที่สำเร็จรูป + ชื่อ ดับเบิลคลิกชื่อเพื่อแก้ไข ดู wf_map_dm.png
 *  (แท็บ Base) — พอร์ตไอเดียมาจาก buddybook_demo/tool_map (แก้ให้เป็นไอคอน lucide-react
 *  แทน SVG มือวาด และผูก rename กับ backend จริง)
 *  เพิ่มภายหลัง (audit fix) — เลือกแล้วมี NodeToolbar ให้ย่อ-ขยาย/หมุน/พลิก/จัดเลเยอร์ และปุ่ม
 *  "หมุดผูกฐานข้อมูล" (lore link) เปิดแผงเนื้อหา + ลิงก์ตอนที่เกี่ยวข้อง */
export function LocationNode({ id, data, selected }: NodeProps) {
  const { name, icon, scale = 1, rotation = 0, flipX = false, onRename, onTransform, onLayerOrder, onOpenLore } =
    data as LocationNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(name);
  const IconComponent = LOCATION_ICONS[icon as LocationIconKey] ?? MapPinned;

  function commitRename() {
    setIsEditing(false);
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== name) {
      onRename?.(id, trimmed);
    } else {
      setTempName(name);
    }
  }

  const handleClass =
    "!h-3 !w-3 !border-2 !border-white !bg-brand-tan-dark !opacity-0 transition-opacity group-hover:!opacity-100";

  return (
    <div className="group flex flex-col items-center gap-1.5">
      <NodeToolbar position={Position.Top} className="flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
        <button type="button" className={iconBtnClass} title="ย่อ" onClick={() => onTransform?.(id, { scale: Math.max(0.3, scale - 0.1) })}>
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" className={iconBtnClass} title="ขยาย" onClick={() => onTransform?.(id, { scale: Math.min(3, scale + 0.1) })}>
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" className={iconBtnClass} title="หมุนซ้าย" onClick={() => onTransform?.(id, { rotation: rotation - 15 })}>
          <RotateCcw className="h-4 w-4" />
        </button>
        <button type="button" className={iconBtnClass} title="หมุนขวา" onClick={() => onTransform?.(id, { rotation: rotation + 15 })}>
          <RotateCw className="h-4 w-4" />
        </button>
        <button type="button" className={iconBtnClass} title="พลิกซ้าย-ขวา" onClick={() => onTransform?.(id, { flip_x: !flipX })}>
          <FlipHorizontal className="h-4 w-4" />
        </button>
        <div className="mx-0.5 h-5 w-px bg-neutral-200" />
        <button type="button" className={iconBtnClass} title="เอาไว้หน้าสุด" onClick={() => onLayerOrder?.(id, "front")}>
          <ChevronsUp className="h-4 w-4" />
        </button>
        <button type="button" className={iconBtnClass} title="เอาไว้หลังสุด" onClick={() => onLayerOrder?.(id, "back")}>
          <ChevronsDown className="h-4 w-4" />
        </button>
        <div className="mx-0.5 h-5 w-px bg-neutral-200" />
        <button
          type="button"
          className={cn(iconBtnClass, "text-primary-500 hover:bg-primary-50")}
          title="เนื้อหาเรื่องราว (Lore)"
          onClick={() => onOpenLore?.(id)}
        >
          <BookOpen className="h-4 w-4" />
        </button>
      </NodeToolbar>

      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />

      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-tan/30 shadow-md transition-transform"
        style={{ transform: `scale(${scale}) rotate(${rotation}deg) ${flipX ? "scaleX(-1)" : ""}` }}
      >
        <IconComponent className="h-7 w-7 text-brand-tan-dark" />
      </div>

      {isEditing ? (
        <input
          autoFocus
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setTempName(name);
              setIsEditing(false);
            }
          }}
          className="nodrag w-24 rounded-pill border border-primary-400 bg-white px-2 py-0.5 text-center text-xs font-medium text-neutral-800 outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => setIsEditing(true)}
          title="ดับเบิลคลิกเพื่อแก้ไขชื่อ"
          className={cn(
            "cursor-text rounded-pill bg-white px-2 py-0.5 text-xs font-medium text-neutral-700 shadow-sm",
            selected && "ring-2 ring-primary-400"
          )}
        >
          {name}
        </span>
      )}

      <Handle type="source" position={Position.Right} id="right" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} />
    </div>
  );
}
