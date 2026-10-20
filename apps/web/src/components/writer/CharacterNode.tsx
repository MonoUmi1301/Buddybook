import { createContext, useContext } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

/** ฟังก์ชันลบตัวละคร — ส่งมาจาก CharacterGraph (หน้านักเขียน) เท่านั้น
 *  แผนผังฝั่งผู้อ่านไม่มี provider นี้ → ไม่แสดงปุ่มลบ */
export const CharacterNodeActionsContext = createContext<{
  onDelete: (nodeId: string, name: string) => void;
} | null>(null);

export interface CharacterNodeData {
  name: string;
  avatarUrl?: string;
  [key: string]: unknown;
}

const handleClass =
  "!h-3 !w-3 !border-2 !border-white !bg-primary-400 !opacity-0 transition-opacity group-hover:!opacity-100";

/** Node ที่กำหนดเอง สำหรับผังความสัมพันธ์ตัวละคร — วงกลม avatar + ชื่อ ดู wf_map_dm.png
 *  เพิ่มภายหลัง (audit fix) — เดิมมีจุดลากเชื่อมแค่บน/ล่าง ผู้ใช้ขอให้ลากได้รอบวงกลม จึงเพิ่มเป็น
 *  4 ทิศ (บน/ขวา/ล่าง/ซ้าย) ทุกจุดเป็น type="source" ทั้งหมด คู่กับ connectionMode="loose" ที่
 *  CharacterGraph.tsx (ให้ลากจากจุดไหนไปจุดไหนก็ได้ ไม่ต้องแยก source/target ตายตัว) */
export function CharacterNode({ id, data, selected }: NodeProps) {
  const { name, avatarUrl } = data as CharacterNodeData;
  const actions = useContext(CharacterNodeActionsContext);
  return (
    <div className="group relative flex flex-col items-center gap-1">
      {actions && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            actions.onDelete(id, name);
          }}
          title={`ลบ ${name}`}
          aria-label={`ลบ ${name}`}
          className={`character-node-delete nodrag nopan absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow transition-opacity hover:bg-red-600 ${
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />
      {/* แคนวาสซูมได้ถึงหลายเท่า — ขอรูปใหญ่กว่ากล่อง 56px ไว้ก่อน กันรูปแตก */}
      <Avatar src={avatarUrl} alt={name} size="lg" sizes="256px" className="ring-2 ring-white shadow-md" />
      <span className="rounded-pill bg-white px-2 py-0.5 text-xs font-medium text-neutral-700 shadow-sm">
        {name}
      </span>
    </div>
  );
}
