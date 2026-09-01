import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Avatar } from "@/components/ui/Avatar";

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
export function CharacterNode({ data }: NodeProps) {
  const { name, avatarUrl } = data as CharacterNodeData;
  return (
    <div className="group flex flex-col items-center gap-1">
      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />
      <Avatar src={avatarUrl} alt={name} size="lg" className="ring-2 ring-white shadow-md" />
      <span className="rounded-pill bg-white px-2 py-0.5 text-xs font-medium text-neutral-700 shadow-sm">
        {name}
      </span>
    </div>
  );
}
