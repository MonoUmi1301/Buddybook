"use client";

import { useEffect, useState } from "react";

/**
 * เพิ่มภายหลัง (Gift donations) — แจ้งเตือนสั้น ๆ มุมล่างของจอ เรียกได้จากทุกที่ด้วย toast("ข้อความ")
 * (mount <Toaster /> ครั้งเดียวใน app/layout.tsx) ข้อความเป็น plain text เท่านั้น
 * อยู่รอดข้ามการเปลี่ยนหน้าได้เพราะ layout ไม่ถูก unmount
 */
const TOAST_EVENT = "bb:toast";
const DURATION_MS = 4000;

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: message }));
}

interface ToastItem {
  id: number;
  message: string;
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    function onToast(e: Event) {
      const message = (e as CustomEvent<string>).detail;
      const id = ++nextId;
      setItems((prev) => [...prev.slice(-2), { id, message }]);
      const timer = setTimeout(() => {
        timers.delete(timer);
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, DURATION_MS);
      timers.add(timer);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto max-w-md rounded-pill bg-neutral-900 px-5 py-3 text-center text-sm font-medium text-neutral-50 shadow-lg animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
