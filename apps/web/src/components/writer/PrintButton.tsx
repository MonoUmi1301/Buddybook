"use client";

import { Printer } from "lucide-react";

/** ปุ่มสั่งพิมพ์ — ใช้ window.print() ของเบราว์เซอร์ตรง ๆ (ไม่ generate PDF เอง) ซ่อนตัวเองตอน
 *  พิมพ์จริงด้วย print:hidden เพื่อไม่ให้ติดไปในกระดาษ */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex h-10 items-center gap-2 rounded-pill bg-primary-500 px-5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
    >
      <Printer className="h-4 w-4" />
      พิมพ์
    </button>
  );
}
