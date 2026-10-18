"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const KEY = "bb:in-app-nav";

/** true เมื่อแท็บนี้เปลี่ยนหน้าภายในเว็บมาแล้วอย่างน้อยหนึ่งครั้ง — router.back() จึงพากลับหน้าในเว็บแน่นอน
 *  (ไม่ใช่ออกไปเว็บอื่น หรือไม่ทำอะไรเลยตอนเปิดลิงก์ตรงในแท็บใหม่) */
export function hasInAppHistory(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** mount ครั้งเดียวใน app/layout.tsx — จดว่ามีการเปลี่ยนหน้าภายในเว็บแล้ว */
export function NavigationTracker() {
  const pathname = usePathname();
  const first = useRef<string | null>(null);

  useEffect(() => {
    if (first.current === null) {
      first.current = pathname;
      return;
    }
    if (pathname !== first.current) {
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        // storage ถูกปิด — BackButton จะใช้ href สำรองแทน
      }
    }
  }, [pathname]);

  return null;
}
