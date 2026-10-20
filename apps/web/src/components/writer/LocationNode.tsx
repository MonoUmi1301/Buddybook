"use client";

import { useState } from "react";
import { Handle, NodeToolbar, Position, type NodeProps } from "@xyflow/react";
import {
  BookOpen,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  ChevronsUp,
  ChevronsDown,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { MAP_INK_FILTER, MapAssetIcon, getLocationAsset } from "@/components/writer/mapAssets";

// รายการภาพ/ไอคอนสถานที่ย้ายไปอยู่ที่ mapAssets.tsx — re-export ไว้ให้ไฟล์อื่นที่ import จากที่นี่ใช้ต่อได้
export { LOCATION_ICONS, type LocationIconKey } from "@/components/writer/mapAssets";

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
  onDelete?: (nodeId: string) => void;
  [key: string]: unknown;
}

// กรอบไอคอน (ก่อนคูณ scale) + ความสูงของป้ายชื่อรวมช่องไฟ — ใช้คำนวณขนาดโหนดจริงใน WorldMap
// เพื่อให้ป้ายชื่อเลื่อนลงตามไอคอนที่ขยาย (เดิมใช้ CSS scale อย่างเดียว ไอคอนเลยขยายทับป้ายชื่อ)
export const LOCATION_ICON_BOX = 64;
const LABEL_BLOCK_HEIGHT = 28;
const MIN_NODE_WIDTH = 88;

export function locationNodeSize(scale: number): { width: number; height: number; iconBox: number } {
  const iconBox = Math.round(LOCATION_ICON_BOX * scale);
  return { width: Math.max(MIN_NODE_WIDTH, iconBox + 8), height: iconBox + LABEL_BLOCK_HEIGHT, iconBox };
}

const iconBtnClass =
  "flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200";

/** Node แผนที่จักรวาล — ไอคอนสถานที่สำเร็จรูป + ชื่อ ดับเบิลคลิกชื่อเพื่อแก้ไข ดู wf_map_dm.png
 *  (แท็บ Base) — พอร์ตไอเดียมาจาก buddybook_demo/tool_map (แก้ให้เป็นไอคอน lucide-react
 *  แทน SVG มือวาด และผูก rename กับ backend จริง)
 *  เพิ่มภายหลัง (audit fix) — เลือกแล้วมี NodeToolbar ให้ย่อ-ขยาย/หมุน/พลิก/จัดเลเยอร์ และปุ่ม
 *  "หมุดผูกฐานข้อมูล" (lore link) เปิดแผงเนื้อหา + ลิงก์ตอนที่เกี่ยวข้อง */
export function LocationNode({ id, data, selected }: NodeProps) {
  const { name, icon, scale = 1, rotation = 0, flipX = false, onRename, onTransform, onLayerOrder, onOpenLore, onDelete } =
    data as LocationNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(name);
  const asset = getLocationAsset(icon);
  const { iconBox } = locationNodeSize(scale);

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
    <div className="group flex h-full w-full flex-col items-center gap-1.5">
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
        <span className="mx-0.5 h-4 w-px bg-neutral-200" />
        <button
          type="button"
          className={cn(iconBtnClass, "text-red-500 hover:bg-red-50")}
          title="ลบสถานที่"
          onClick={() => onDelete?.(id)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </NodeToolbar>

      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />

      {/* กล่องนอกจองพื้นที่จริงตามขนาดที่ขยายแล้ว ป้ายชื่อด้านล่างจึงถูกดันลงไม่ทับไอคอน */}
      <div className="flex shrink-0 items-center justify-center" style={{ width: iconBox, height: iconBox }}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center transition-transform",
            // ภาพวาดเองแสดงเต็มกรอบไม่มีพื้นหลัง ส่วนไอคอนเส้นยังอยู่ในกล่องสีแทนเหมือนเดิม
            asset?.src ? "h-16 w-16" : "h-14 w-14 rounded-2xl bg-brand-tan/30 shadow-md"
          )}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg) ${flipX ? "scaleX(-1)" : ""}`,
            // เส้นสเก็ตช์บางและขอบโปร่งแสง พอวางบนพื้นภูมิประเทศจะจาง — ทำเส้นให้เข้ม + ขอบขาว
            filter: asset?.src ? MAP_INK_FILTER : undefined,
          }}
        >
          <MapAssetIcon asset={asset} size={asset?.src ? 64 : 28} resolution={512} className="text-brand-tan-dark" />
        </div>
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
            "cursor-text whitespace-nowrap rounded-pill bg-white px-2 py-0.5 text-xs font-medium text-neutral-700 shadow-sm",
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
