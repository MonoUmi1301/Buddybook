"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ModalBackdrop } from "@/components/ui/modal-backdrop";

const FRAME_SIZE = 224;
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface ImageCropDialogProps {
  file: File;
  title?: string;
  onCancel: () => void;
  /** ได้ไฟล์ JPEG สี่เหลี่ยมจัตุรัสที่ครอปแล้ว (OUTPUT_SIZE px) — เอาไปอัปโหลดต่อได้เลย */
  onConfirm: (cropped: File) => void;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** ป๊อปอัปครอปรูปโปรไฟล์/อวาตาร์ — ลากเพื่อขยับ, เลื่อนสไลเดอร์หรือ scroll เมาส์เพื่อซูม, หมุนทีละ 90°
 *  ดัดแปลงจาก file-upload-05 (shadcn) ให้ใช้ Button/cn ของโปรเจกต์ ไม่ต้องลง radix/react-dropzone
 *  รูปถูกบังคับให้คลุมกรอบเต็มเสมอ (clamp offset) จะได้ไม่มีขอบว่างในรูปที่ครอปออกมา */
export function ImageCropDialog({ file, title = "ปรับตำแหน่งรูป", onCancel, onConfirm }: ImageCropDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    let cancelled = false;
    loadImage(url)
      .then((img) => {
        if (cancelled) return;
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        setImageUrl(url);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // ด้านสั้นของรูปพอดีกรอบที่ zoom = 1
  const displayScale = useMemo(() => {
    const { width, height } = naturalSize;
    if (!width || !height) return 1;
    return FRAME_SIZE / Math.min(width, height);
  }, [naturalSize]);

  const displaySize = {
    width: naturalSize.width * displayScale * zoom,
    height: naturalSize.height * displayScale * zoom,
  };

  // จำกัดการขยับไม่ให้ขอบรูปหลุดเข้ามาในกรอบ — หมุน 90/270 แล้วกว้าง/สูงสลับกัน
  function clampOffset(next: { x: number; y: number }, z = zoom, rot = rotation) {
    const sideways = rot % 180 !== 0;
    const w = naturalSize.width * displayScale * z;
    const h = naturalSize.height * displayScale * z;
    const maxX = Math.max(0, ((sideways ? h : w) - FRAME_SIZE) / 2);
    const maxY = Math.max(0, ((sideways ? w : h) - FRAME_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function applyZoom(z: number) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    setZoom(next);
    setOffset((o) => clampOffset(o, next));
  }

  // wheel ต้องเป็น non-passive ถึงจะ preventDefault กันหน้าเลื่อนได้
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoom(zoom - e.deltaY * 0.002);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    const { startX, startY, originX, originY } = dragState.current;
    setOffset(clampOffset({ x: originX + e.clientX - startX, y: originY + e.clientY - startY }));
  }

  function handlePointerUp() {
    dragState.current = null;
    setIsDragging(false);
  }

  function rotate() {
    const next = (rotation + 90) % 360;
    setRotation(next);
    setOffset((o) => clampOffset(o, zoom, next));
  }

  async function confirmCrop() {
    if (!imageUrl) return;
    setProcessing(true);
    try {
      const img = await loadImage(imageUrl);
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // ลำดับเดียวกับ CSS transform ของรูปพรีวิว: เลื่อน (พิกัดกรอบ) → หมุนรอบกลางรูป → ย่อขยาย
      const outputScale = OUTPUT_SIZE / FRAME_SIZE;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.translate(OUTPUT_SIZE / 2 + offset.x * outputScale, OUTPUT_SIZE / 2 + offset.y * outputScale);
      ctx.rotate((rotation * Math.PI) / 180);
      const scale = displayScale * zoom * outputScale;
      ctx.scale(scale, scale);
      ctx.drawImage(img, -naturalSize.width / 2, -naturalSize.height / 2);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) return;
      const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
      onConfirm(new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" }));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <ModalBackdrop className="z-[60] items-center bg-black/50 px-4" onDismiss={() => onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
        className="relative w-full max-w-sm rounded-card bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"
      >
        <h2 id="crop-title" className="mb-1 text-center text-lg font-semibold text-neutral-900">
          {title}
        </h2>
        <p className="mb-4 text-center text-xs text-neutral-500">ลากเพื่อขยับ · เลื่อนแถบหรือ scroll เพื่อซูม</p>

        <div className="flex flex-col items-center gap-4">
          <div
            ref={frameRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={cn(
              "relative touch-none select-none overflow-hidden rounded-full border-2 border-dashed border-primary-400/60 bg-neutral-100",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob: URL ใช้ next/image ไม่ได้
              <img
                src={imageUrl}
                alt="พรีวิวการครอป"
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: displaySize.width,
                  height: displaySize.height,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
                  transition: isDragging ? "none" : "transform 150ms ease-out",
                }}
              />
            ) : (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                {loadError ? "เปิดรูปนี้ไม่ได้" : "กำลังโหลดรูป…"}
              </p>
            )}
            <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/50" />
          </div>

          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              onClick={() => applyZoom(zoom - 0.2)}
              aria-label="ซูมออก"
              className="text-neutral-400 hover:text-neutral-600"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => applyZoom(Number(e.target.value))}
              aria-label="ซูม"
              className="h-1.5 w-full cursor-pointer accent-primary-500"
            />
            <button
              type="button"
              onClick={() => applyZoom(zoom + 0.2)}
              aria-label="ซูมเข้า"
              className="text-neutral-400 hover:text-neutral-600"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={rotate} disabled={!imageUrl}>
            <RotateCw className="h-3.5 w-3.5" />
            หมุน
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              ยกเลิก
            </Button>
            <Button type="button" size="sm" onClick={confirmCrop} loading={processing} disabled={!imageUrl}>
              ใช้รูปนี้
            </Button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
}
