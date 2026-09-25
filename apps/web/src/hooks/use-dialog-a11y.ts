"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * เพิ่มภายหลัง (Gift donations) — พฤติกรรมพื้นฐานของ modal: โฟกัสเข้า dialog ตอนเปิด, วน Tab อยู่ข้างใน,
 * Esc ปิด, ล็อกการเลื่อนหน้าข้างหลัง, คืนโฟกัสให้ปุ่มที่เปิดตอนปิด
 * ส่ง enabled = false ระหว่างที่ไม่ควรปิดได้ (เช่น กำลังส่ง/แอนิเมชันส่งสำเร็จ)
 */
export function useDialogA11y(ref: RefObject<HTMLElement>, onClose: () => void, enabled = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const node = ref.current;
    const first = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus({ preventScroll: true });

    function onKeyDown(e: KeyboardEvent) {
      if (!ref.current) return;
      if (e.key === "Escape") {
        if (enabledRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [ref]);
}
