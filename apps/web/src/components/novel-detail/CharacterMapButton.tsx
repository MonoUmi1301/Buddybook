"use client";

import { useEffect, useState } from "react";
import { ReactFlow, Background, Controls, ConnectionMode, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Network, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  decorateEdge,
  nodeTypes,
  toFlowNode,
  withDefaultHandles,
  type CharacterRecord,
} from "@/components/writer/CharacterGraph";

export interface PublicCharacterMap {
  characters: CharacterRecord[];
  edges: Edge[];
}

/** เพิ่มภายหลัง — ปุ่มไอคอนเล็กบนหน้านิยาย "แผนผังตัวละคร" แสดงเฉพาะนิยายที่นักเขียนกดเผยแพร่แผนผังไว้
 *  (สำเนา ณ ตอนที่กด — ดู novels.service.ts publishCharacterMap) กดแล้วเปิดแผนภาพแบบดูอย่างเดียว ซูม/เลื่อนได้ */
export function CharacterMapButton({
  map,
  className,
  labeled = false,
}: {
  map: PublicCharacterMap;
  className?: string;
  /** true = ปุ่มมีข้อความ "แผนผังตัวละคร" (ใช้ข้างหัวข้อ "แนะนำตัวละคร") / false = ไอคอนกลม (ข้างปุ่มแชร์) */
  labeled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const nodes = map.characters
    .filter((c) => c.position_x !== null && c.position_y !== null)
    .map((c) => ({ ...toFlowNode(c, c.position_x as number, c.position_y as number), draggable: false }));
  const edges = map.edges.map((e) => decorateEdge(withDefaultHandles(e, map.characters)));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="แผนผังตัวละคร"
        title="แผนผังตัวละคร"
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-pill border border-neutral-300 bg-white text-neutral-700 transition-colors",
          labeled ? "h-9 px-3.5 text-sm font-medium" : "h-11 w-11",
          "hover:border-primary-300 hover:text-primary-600",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
          className
        )}
      >
        <Network className="h-4 w-4" />
        {labeled && <span>แผนผังตัวละคร</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="แผนผังตัวละคร"
        >
          <div className="w-full max-w-4xl rounded-card bg-white p-4 shadow-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-h3 text-neutral-900">แผนผังตัวละคร</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="ปิด" className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[70vh] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                // จุดต่อทุกจุดเป็น "source" (ดู toFlowNode) — ต้องเป็นโหมด loose เหมือนหน้านักเขียน
                // ไม่งั้น react-flow หา target handle ไม่เจอแล้วไม่วาดเส้นเลย
                connectionMode={ConnectionMode.Loose}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                edgesFocusable={false}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={16} color="#e5e7eb" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
            <p className="mt-2 text-center text-xs text-neutral-400">เลื่อน/ซูมดูได้ — แผนผังนี้นักเขียนเป็นคนเลือกเผยแพร่</p>
          </div>
        </div>
      )}
    </>
  );
}
