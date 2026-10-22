"use client";

import { useEffect } from "react";

const HEARTBEAT_MS = 60_000; // ตรงกับ apps/api/src/lib/presence.ts
const ENDPOINT = "/api/v1/presence/heartbeat";

function send(leaving = false) {
  const body = JSON.stringify(leaving ? { leaving: true } : {});
  // ตอนปิดแท็บ fetch ปกติอาจถูกยกเลิก — sendBeacon ส่งต่อให้เบราว์เซอร์จัดการ
  if (leaving && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    return;
  }
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {
    // ไม่สำคัญพอจะแจ้งผู้อ่าน — รอบหน้าส่งใหม่เอง
  });
}

/** ผู้อ่านออนไลน์ — ส่ง heartbeat ทุก 1 นาทีเฉพาะตอนแท็บอยู่บนจอ (ไม่แสดงอะไร) */
export function ReaderPresence() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      send();
      timer = setInterval(send, HEARTBEAT_MS);
    };
    const stop = (leaving: boolean) => {
      if (timer) clearInterval(timer);
      timer = null;
      if (leaving) send(true);
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop(true));
    const onPageHide = () => stop(true);

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      stop(true);
    };
  }, []);

  return null;
}
