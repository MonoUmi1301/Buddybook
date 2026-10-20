"use client";

import type { CSSProperties } from "react";
import Image, { getImageProps } from "next/image";
import {
  Trees,
  TreePine,
  Skull,
  Waves,
  Flame,
  Store,
  Landmark,
  MapPinned,
  Mountain,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** กราฟฟิกของแผนที่โลก (World Map) — รวมไว้ที่เดียว
 *  - มี `src` = ใช้ภาพที่วาดเอง (ไฟล์อยู่ใน apps/web/public/locations/ และ public/stamps/)
 *  - ไม่มี `src` = ยังไม่มีภาพ ใช้ไอคอน lucide (`Icon`) ไปก่อน
 *  key ถูกบันทึกลงฐานข้อมูล (Location.map_icon_url / map drawing ของ stamp) ห้ามเปลี่ยนชื่อ key เดิม
 *  ถ้าจะเพิ่มภาพใหม่: วางไฟล์ใน public/ แล้วเพิ่ม key ใหม่ในรายการด้านล่างได้เลย */
export interface MapAsset {
  label: string;
  src?: string;
  Icon?: LucideIcon;
}

export const LOCATION_ICONS = {
  castle: { label: "ปราสาท", src: "/locations/castle_sketch.png" },
  village: { label: "บ้าน", src: "/locations/home_sketch.png" },
  school: { label: "โรงเรียน", src: "/locations/school_Rough.png" },
  condo: { label: "คอนโด", src: "/locations/condo_Rough.png" },
  lake: { label: "ทะเลสาบ", src: "/locations/lake_sketch.png" },
  sea: { label: "ทะเล", src: "/locations/water_sketch.png" },
  // ยังไม่มีภาพวาด — ใช้ไอคอนเดิม
  forest: { label: "ป่า", Icon: Trees },
  dungeon: { label: "คุกใต้ดิน", Icon: Skull },
  volcano: { label: "ภูเขาไฟ", Icon: Flame },
  market: { label: "ตลาด", Icon: Store },
  shrine: { label: "วิหาร", Icon: Landmark },
} satisfies Record<string, MapAsset>;

export type LocationIconKey = keyof typeof LOCATION_ICONS;
export const LOCATION_ICON_KEYS = Object.keys(LOCATION_ICONS) as LocationIconKey[];

export function getLocationAsset(key: string | null | undefined): MapAsset | undefined {
  return key ? (LOCATION_ICONS as Record<string, MapAsset>)[key] : undefined;
}

/** ไอคอนปั๊ม (stamp) ตกแต่งพื้นแผนที่ — วางซ้ำ ๆ ตอนลากเมาส์ */
export const STAMP_ICONS = {
  mountain: { label: "เทือกเขา", src: "/stamps/mountain_Rough.png" },
  forest: { label: "ป่าทึบ", src: "/stamps/forest_Rough.png" },
  coconut: { label: "ต้นมะพร้าว", src: "/stamps/coconuttree_Rough.png" },
  house: { label: "บ้านเมือง", src: "/stamps/home_Rough.png" },
  sea: { label: "คลื่นทะเล", src: "/stamps/sea_cartoon.png" },
  water: { label: "ผืนน้ำ", src: "/stamps/water_cartoon.png" },
  // ยังไม่มีภาพวาด — ใช้ไอคอนเดิม
  tree: { label: "ต้นไม้", Icon: TreePine },
  river: { label: "แม่น้ำ", Icon: Waves },
} satisfies Record<string, MapAsset>;

export type StampIconKey = keyof typeof STAMP_ICONS;
export const STAMP_OPTIONS = (Object.keys(STAMP_ICONS) as StampIconKey[]).map((key) => ({
  key,
  ...(STAMP_ICONS[key] as MapAsset),
}));

export function getStampAsset(key: string | null | undefined): MapAsset | undefined {
  return key ? (STAMP_ICONS as Record<string, MapAsset>)[key] : undefined;
}

/** ไอคอนแบบ HTML (ใช้ในโหนดสถานที่, แถบรอวาง, ป๊อปอัพเลือกไอคอน, แถบเลือก stamp)
 *  ภาพผ่าน next/image เพื่อย่อไฟล์ 2048px ให้เล็กลงอัตโนมัติ */
export function MapAssetIcon({
  asset,
  size,
  className,
  fallback = MapPinned,
  resolution,
}: {
  asset: MapAsset | undefined;
  size: number;
  className?: string;
  fallback?: LucideIcon;
  /** ความละเอียดภาพที่ขอจาก optimizer (px) — ต้องมากกว่าขนาดที่แสดง เพราะบนแคนวาสภาพถูกขยาย
   *  ซ้ำอีกชั้นจากปุ่มย่อ-ขยาย (สูงสุด 3x) และการซูมแผนที่ ถ้าขอเท่าขนาดที่แสดงภาพจะแตก */
  resolution?: number;
}) {
  if (asset?.src) {
    const res = resolution ?? size * 2;
    return (
      <Image
        src={asset.src}
        alt=""
        width={res}
        height={res}
        quality={90}
        draggable={false}
        className={cn("pointer-events-none select-none object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const Icon = asset?.Icon ?? fallback;
  return <Icon className={className} style={{ width: size, height: size }} />;
}

// URL ภาพที่ย่อแล้วผ่าน image optimizer ของ Next (ใช้ใน <image> ของ SVG ซึ่งใช้ next/image ตรง ๆ ไม่ได้)
const optimizedSrcCache = new Map<string, string>();
function optimizedSrc(src: string, width: number): string {
  const cacheKey = `${src}@${width}`;
  let url = optimizedSrcCache.get(cacheKey);
  if (!url) {
    url = getImageProps({ src, alt: "", width, height: width, quality: 90 }).props.src;
    optimizedSrcCache.set(cacheKey, url);
  }
  return url;
}

/** ฟิลเตอร์ "เข้มเส้น" ของภาพสเก็ตช์ — ภาพวาดเป็นเส้นดำที่ขอบโปร่งแสงบางส่วน พอย่อลงเหลือ 40–64px
 *  เส้นจึงจางจนแทบมองไม่เห็นบนพื้นภูมิประเทศ ฟิลเตอร์นี้คูณค่า alpha ให้เส้นทึบขึ้น แล้วใส่ขอบขาวบาง ๆ
 *  รอบเส้นให้ตัดกับพื้นหลังสีเข้ม — ต้องเรนเดอร์ <MapInkFilterDefs /> ไว้ในหน้าเดียวกันหนึ่งครั้ง */
export const MAP_INK_FILTER_ID = "map-ink-filter";
export const MAP_INK_FILTER = `url(#${MAP_INK_FILTER_ID}) drop-shadow(0 0 1.5px rgba(255,255,255,0.9))`;

export function MapInkFilterDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <filter id={MAP_INK_FILTER_ID} colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncA type="linear" slope="3" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

// ขนาดพื้นฐานของ stamp บนแคนวาส (ก่อนคูณ scale) — ใช้ทั้งตอนวาดและตอนหาว่าคลิกโดน stamp ไหน
export function stampBaseSize(asset: MapAsset | undefined): number {
  // ภาพวาดมีรายละเอียดมากกว่าไอคอนเส้น เลยให้ใหญ่กว่าเล็กน้อย
  return asset?.src ? 40 : 28;
}

/** stamp ที่วาดอยู่ใน <svg> ของเลเยอร์วาดแผนที่
 *  color — ไอคอนเส้นเปลี่ยนสีเส้นตรง ๆ ส่วนภาพวาดใช้ฟิลเตอร์ย้อมสี (ส่วนที่เข้มของภาพกลายเป็นสีที่เลือก) */
export function SvgStamp({
  asset,
  x,
  y,
  scale = 1,
  rotation,
  color,
}: {
  asset: MapAsset | undefined;
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  color?: string;
}) {
  const style: CSSProperties = {
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    transformOrigin: `${x}px ${y}px`,
  };
  const size = stampBaseSize(asset) * scale;
  if (asset?.src) {
    const tintId = color ? `stamp-tint-${color.replace(/[^a-zA-Z0-9]/g, "")}` : null;
    return (
      <g style={style}>
        {tintId && (
          <defs>
            <filter id={tintId} colorInterpolationFilters="sRGB">
              {/* alpha ใหม่ = alpha เดิม − ความสว่าง → ส่วนเส้นเข้มคงอยู่ ส่วนสีอ่อนจางหาย แล้วเติมสีที่เลือก */}
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 -1 -1 3 0" result="ink" />
              <feFlood floodColor={color} />
              <feComposite operator="in" in2="ink" />
            </filter>
          </defs>
        )}
        <image
          href={optimizedSrc(asset.src, 256)}
          x={x - size / 2}
          y={y - size / 2}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid meet"
          style={{ filter: tintId ? `url(#${tintId})` : MAP_INK_FILTER }}
        />
      </g>
    );
  }
  const Icon = asset?.Icon ?? Mountain;
  return <Icon x={x - size / 2} y={y - size / 2} width={size} height={size} color={color ?? "#57534e"} strokeWidth={2.25} style={style} />;
}
