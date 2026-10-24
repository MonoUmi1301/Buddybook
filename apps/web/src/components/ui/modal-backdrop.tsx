"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ModalBackdropProps {
  /** คลิกพื้นหลัง (นอกกล่อง) — ไม่ส่งมาแปลว่าคลิกนอกกล่องแล้วไม่ปิด */
  onDismiss?: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * ฉากหลังของ modal: คลิกนอกกล่องเพื่อปิด โดยใช้ <button> โปร่งใสวางเป็น "พี่น้อง" ของกล่อง แทน onClick
 * บน <div> + stopPropagation ที่กล่อง (โดน a11y lint/Sonar ว่าใส่ click บน element ที่ไม่ใช่ interactive)
 * ปุ่มนี้ไม่รับโฟกัส (tabIndex -1) และซ่อนจาก screen reader — คีย์บอร์ดปิดด้วย Esc / ปุ่มปิดในกล่องแทน
 *
 * กล่องที่ส่งเป็น children ต้องเป็น positioned (เช่น `relative`) ไม่งั้นจะถูกปุ่มฉากหลังทับ
 * กดในกล่องแล้วลากมาปล่อยนอกกล่องจะไม่ปิด (click ไปเกิดที่ div นอกสุด ไม่ใช่ที่ปุ่ม)
 */
export function ModalBackdrop({ onDismiss, className, children }: ModalBackdropProps) {
  return (
    <div className={cn("fixed inset-0 flex justify-center", className)}>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onDismiss}
      />
      {children}
    </div>
  );
}
