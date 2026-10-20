"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/** หมีมาสคอต (แว่นกลม) เวอร์ชันตกใจ — ตาโต ปากกลม เหงื่อตก สั่นนิด ๆ ตอนเปิด */
export function ShockedBear({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <style>{`
        @keyframes bb-bear-shake { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-6deg)} 40%{transform:rotate(5deg)} 60%{transform:rotate(-3deg)} 80%{transform:rotate(2deg)} }
        @keyframes bb-bear-drop { 0%{transform:translateY(-4px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        .bb-bear { transform-origin: 60px 90px; animation: bb-bear-shake .6s ease-in-out 1; }
        .bb-drop { animation: bb-bear-drop .4s ease-out .25s both; }
      `}</style>
      {/* เครื่องหมายตกใจ */}
      <g stroke="#ef4444" strokeWidth="4" strokeLinecap="round">
        <path d="M14 22 L22 30" />
        <path d="M8 38 L18 40" />
        <path d="M106 22 L98 30" />
      </g>
      <g className="bb-bear" stroke="#5B3A22" strokeWidth="4">
        {/* หู */}
        <circle cx="28" cy="36" r="15" fill="#B87640" />
        <circle cx="92" cy="36" r="15" fill="#B87640" />
        <circle cx="28" cy="37" r="7" fill="#F8F4EC" stroke="none" />
        <circle cx="92" cy="37" r="7" fill="#F8F4EC" stroke="none" />
        {/* ผมชี้ */}
        <path d="M57 30 C55 20, 60 13, 67 12" fill="none" strokeLinecap="round" />
        <path d="M63 29 C66 24, 71 22, 76 23" fill="none" strokeLinecap="round" />
        {/* หัว */}
        <ellipse cx="60" cy="70" rx="46" ry="40" fill="#B87640" />
        {/* แก้มแดง */}
        <ellipse cx="27" cy="82" rx="8" ry="4.5" fill="#E8A096" stroke="none" />
        <ellipse cx="93" cy="82" rx="8" ry="4.5" fill="#E8A096" stroke="none" />
        {/* ปาก-จมูก */}
        <ellipse cx="60" cy="90" rx="17" ry="14" fill="#F8F4EC" stroke="none" />
        <ellipse cx="60" cy="81" rx="5" ry="3.5" fill="#5B3A22" stroke="none" />
        <ellipse cx="60" cy="94" rx="4.5" ry="6" fill="#5B3A22" stroke="none" />
        {/* แว่น + ตาโต */}
        <circle cx="42" cy="62" r="13" fill="#F8F4EC" />
        <circle cx="78" cy="62" r="13" fill="#F8F4EC" />
        <path d="M55 61 Q60 57 65 61" fill="none" />
        <circle cx="42" cy="62" r="3.5" fill="#5B3A22" stroke="none" />
        <circle cx="78" cy="62" r="3.5" fill="#5B3A22" stroke="none" />
      </g>
      {/* เหงื่อ */}
      <path
        className="bb-drop"
        d="M104 46 C104 46 97 55 97 59 A7 7 0 0 0 111 59 C111 55 104 46 104 46 Z"
        fill="#8EC9F0"
        stroke="#4a9fd8"
        strokeWidth="2"
      />
    </svg>
  );
}

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
}

/** ป๊อปอัปยืนยันบนเว็บ (แทน window.confirm) — ใช้:
 *  const [confirm, confirmDialog] = useConfirm();
 *  if (!(await confirm({ title: "ลบ?" }))) return;
 *  ...แล้ววาง {confirmDialog} ไว้ใน JSX */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const dialog = options ? <ConfirmDialog {...options} onClose={close} /> : null;
  return [confirm, dialog];
}

function ConfirmDialog({
  title,
  message,
  confirmText = "ลบเลย",
  cancelText = "ยกเลิก",
  onClose,
}: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-sm rounded-card bg-white p-6 text-center shadow-xl">
        <ShockedBear className="mx-auto mb-3 h-28 w-28" />
        <h2 id="confirm-title" className="text-lg font-semibold text-neutral-900">
          {title}
        </h2>
        {message && <div className="mt-1.5 text-sm text-neutral-500">{message}</div>}
        <div className="mt-6 flex justify-center gap-3">
          <Button ref={cancelRef} type="button" variant="outline" onClick={() => onClose(false)}>
            {cancelText}
          </Button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className="rounded-pill bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
