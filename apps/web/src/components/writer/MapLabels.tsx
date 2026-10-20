"use client";

/** ชื่อพื้นที่บนแผนที่ (ทวีป/อาณาจักร/ประเทศ/ภูมิภาค/เมือง) — เก็บใน map_drawings kind "label"
 *  วาดเป็น <text> ใน SVG เลเยอร์เดียวกับภูมิประเทศ มีขอบขาว (halo) ให้อ่านออกบนพื้นทุกสี
 *  attachTo = id ของชิ้นส่วนแผนที่ที่ชื่อนี้ผูกอยู่ — ย้ายชิ้นส่วนแล้วชื่อเลื่อนตามไปด้วย (WorldMap) */

import { useLayoutEffect, useRef } from "react";
import type { Point } from "@/components/writer/MapTerrain";

export type LabelFont = "serif" | "sans" | "sarabun";
export type LabelCategory = "continent" | "kingdom" | "country" | "region" | "city";

export interface MapLabel {
  id: string;
  kind: "label";
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  font: LabelFont;
  rotation?: number;
  italic?: boolean;
  /** ระยะห่างตัวอักษร (em) */
  spacing?: number;
  category?: LabelCategory;
  attachTo?: string;
  /** สร้างโดยระบบสุ่มแผนที่ (ประเภท) — ถูกลบออกเมื่อผู้ใช้แก้ไขเอง ดู mapGenerator.ts */
  gen?: "land" | "terrain" | "water" | "labels" | "settlements";
}

export const LABEL_FONTS: { key: LabelFont; label: string; family: string }[] = [
  { key: "serif", label: "หนังสือ (มีหัว)", family: "var(--font-noto-serif-thai), serif" },
  { key: "sans", label: "เรียบ", family: "var(--font-ibm-plex-sans-thai), sans-serif" },
  { key: "sarabun", label: "สารบรรณ", family: "var(--font-sarabun), sans-serif" },
];

// ระยะห่างตัวอักษรตั้งต้นต่ำ — ภาษาไทยถ้าถ่างมาก สระ/วรรณยุกต์จะดูหลุดจากพยัญชนะ อ่านยาก
export const LABEL_CATEGORIES: { key: LabelCategory; label: string; preset: Pick<MapLabel, "size" | "color" | "font" | "italic" | "spacing"> }[] = [
  { key: "continent", label: "ทวีป", preset: { size: 40, color: "#3b2f20", font: "serif", italic: false, spacing: 0.12 } },
  { key: "kingdom", label: "อาณาจักร", preset: { size: 28, color: "#5b2a1a", font: "serif", italic: false, spacing: 0.06 } },
  { key: "country", label: "ประเทศ", preset: { size: 22, color: "#2f3b55", font: "serif", italic: false, spacing: 0.03 } },
  { key: "region", label: "ภูมิภาค", preset: { size: 17, color: "#4a4a3a", font: "serif", italic: true, spacing: 0.02 } },
  { key: "city", label: "เมือง", preset: { size: 14, color: "#1c1917", font: "sans", italic: false, spacing: 0 } },
];

export const LABEL_COLORS = ["#1c1917", "#3b2f20", "#5b2a1a", "#7f1d1d", "#2f3b55", "#14532d", "#4c1d95", "#ffffff"];
export const LABEL_MIN_SIZE = 8;
export const LABEL_MAX_SIZE = 120;

export function fontFamilyOf(font: LabelFont): string {
  return LABEL_FONTS.find((f) => f.key === font)?.family ?? LABEL_FONTS[0].family;
}

/** กล่องขอบเขตของข้อความ (ก่อนหมุน) วัดจาก DOM จริงหลังเรนเดอร์ — ใช้ตอนคลิกเลือกและกรอบแก้ไข */
export type LabelBox = { x: number; y: number; w: number; h: number };

export function estimateLabelBox(label: MapLabel): LabelBox {
  const w = Math.max(label.size, label.text.length * label.size * (0.55 + (label.spacing ?? 0)));
  const h = label.size * 1.3;
  return { x: label.x - w / 2, y: label.y - h / 2, w, h };
}

export function hitLabel(label: MapLabel, box: LabelBox | undefined, pt: Point): boolean {
  const b = box ?? estimateLabelBox(label);
  const r = (-(label.rotation ?? 0) * Math.PI) / 180;
  const dx = pt.x - label.x;
  const dy = pt.y - label.y;
  const lx = label.x + dx * Math.cos(r) - dy * Math.sin(r);
  const ly = label.y + dx * Math.sin(r) + dy * Math.cos(r);
  const pad = 4;
  return lx >= b.x - pad && lx <= b.x + b.w + pad && ly >= b.y - pad && ly <= b.y + b.h + pad;
}

export function LabelsLayer({
  labels,
  boxesRef,
  selectedId,
  zoom,
}: {
  labels: MapLabel[];
  boxesRef: React.MutableRefObject<Map<string, LabelBox>>;
  selectedId: string | null;
  zoom: number;
}) {
  const textRefs = useRef(new Map<string, SVGTextElement>());

  // วัดขนาดข้อความจริง (ฟอนต์ไทยกว้างไม่เท่ากัน ประมาณจากจำนวนตัวอักษรไม่แม่น)
  useLayoutEffect(() => {
    const next = new Map<string, LabelBox>();
    for (const l of labels) {
      const el = textRefs.current.get(l.id);
      if (!el) continue;
      try {
        const b = el.getBBox();
        next.set(l.id, { x: b.x, y: b.y, w: b.width, h: b.height });
      } catch {
        // getBBox โยน error ได้ถ้า element ยังไม่ถูกวาด — ใช้ค่าประมาณแทน
      }
    }
    boxesRef.current = next;
  });

  return (
    <g>
      {labels.map((l) => {
        const box = boxesRef.current.get(l.id) ?? estimateLabelBox(l);
        return (
          <g key={l.id} transform={l.rotation ? `rotate(${l.rotation} ${l.x} ${l.y})` : undefined}>
            {l.id === selectedId && (
              <rect
                x={box.x - 4}
                y={box.y - 3}
                width={box.w + 8}
                height={box.h + 6}
                rx={4}
                fill="none"
                stroke="#f97316"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${5 / zoom} ${4 / zoom}`}
              />
            )}
            <text
              ref={(el) => {
                if (el) textRefs.current.set(l.id, el);
                else textRefs.current.delete(l.id);
              }}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={l.color}
              stroke={l.color.toLowerCase() === "#ffffff" ? "rgba(28,25,23,0.7)" : "rgba(255,255,255,0.85)"}
              strokeWidth={Math.max(2, l.size * 0.16)}
              strokeLinejoin="round"
              paintOrder="stroke"
              style={{
                fontFamily: fontFamilyOf(l.font),
                fontSize: l.size,
                fontStyle: l.italic ? "italic" : "normal",
                fontWeight: l.category === "continent" || l.category === "kingdom" ? 600 : 500,
                letterSpacing: `${l.spacing ?? 0}em`,
              }}
            >
              {l.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
