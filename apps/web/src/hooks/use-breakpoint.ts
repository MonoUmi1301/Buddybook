"use client";

import { useEffect, useState } from "react";

export type Breakpoint = "desktop" | "tablet" | "mobile";

/** ตรงกับ screens ใน tailwind.config.ts — lg = 1024, md = 768 */
const TABLET_QUERY = "(min-width: 768px) and (max-width: 1023.98px)";
const MOBILE_QUERY = "(max-width: 767.98px)";
/** ตัดสินจากอุปกรณ์รับ input ไม่ใช่ความกว้างจอ — แท็บเล็ตจอกว้างก็ยังเป็นจอสัมผัส */
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

function read(): { breakpoint: Breakpoint; canHover: boolean } {
  const breakpoint: Breakpoint = window.matchMedia(MOBILE_QUERY).matches
    ? "mobile"
    : window.matchMedia(TABLET_QUERY).matches
      ? "tablet"
      : "desktop";
  return { breakpoint, canHover: window.matchMedia(FINE_POINTER_QUERY).matches };
}

/**
 * Desktop-first: render แรก (ทั้งฝั่ง server และ hydration) คืน "desktop" + canHover เสมอ
 * แล้วค่อยอัปเดตหลัง mount — ค่า HTML จาก server กับ client จึงตรงกัน ไม่เกิด hydration warning
 * ใช้เฉพาะความต่างที่ CSS ทำไม่ได้ (autoplay, จำนวนการ์ด, hover vs tap) — layout ใช้ max-* ของ Tailwind
 */
export function useBreakpoint() {
  const [state, setState] = useState<{ breakpoint: Breakpoint; canHover: boolean }>({
    breakpoint: "desktop",
    canHover: true,
  });

  useEffect(() => {
    const queries = [TABLET_QUERY, MOBILE_QUERY, FINE_POINTER_QUERY].map((q) => window.matchMedia(q));
    const update = () => setState(read());
    update();
    queries.forEach((mq) => mq.addEventListener("change", update));
    return () => queries.forEach((mq) => mq.removeEventListener("change", update));
  }, []);

  return state;
}
