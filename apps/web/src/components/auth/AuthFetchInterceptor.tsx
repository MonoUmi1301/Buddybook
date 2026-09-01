"use client";

import { useEffect } from "react";

/**
 * แก้บั๊กใหญ่ที่พบระหว่าง audit: access token หมดอายุแค่ 15 นาที (env.JWT_EXPIRES_IN) แต่ไม่มีที่ไหน
 * ในแอปเรียก POST /api/v1/auth/refresh อัตโนมัติเลยสักจุด (endpoint นี้ทำงานถูกต้องสมบูรณ์อยู่แล้ว
 * — ดู app/api/v1/auth/refresh/route.ts — แค่ไม่เคยถูกเรียก) ทุกปุ่มที่ยิง fetch("/api/v1/...")
 * ตรง ๆ (เกือบทั้งแอป ไม่ได้ผ่าน apiClient เดียว) จะเจอ 401 "Unauthorized" ทันทีที่ session
 * อายุเกิน 15 นาที แม้ refresh token (อายุ 30 วัน) ยังไม่หมดอายุเลยก็ตาม
 *
 * แก้ที่จุดเดียวตรงนี้แทนการไล่แก้ทุก fetch call: monkeypatch window.fetch ระดับ global ให้ทุก
 * request ไป /api/v1/* (ยกเว้นตัว refresh เองกันวนลูป) ที่โดน 401 ลองขอ access token ใหม่ด้วย
 * refresh token (คนละ secret จาก access token อยู่แล้ว ดู jwt.ts) แล้วยิง request เดิมซ้ำอีกครั้ง
 * เดียว — ถ้า refresh token หมดอายุด้วย (เกิน 30 วัน) ก็ปล่อยให้ 401 เดิมผ่านไปตามปกติ
 * (หน้าที่ยิง redirect("/login") เองอยู่แล้วตอน getCurrentUser() คืน null จะจัดการต่อเอง)
 */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function AuthFetchInterceptor() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = resolveUrl(input);
      const isOwnApi = url.startsWith("/api/v1/") || url.startsWith(`${window.location.origin}/api/v1/`);
      const isRefreshCall = url.includes("/api/v1/auth/refresh");

      const response = await originalFetch(input, init);

      if (response.status === 401 && isOwnApi && !isRefreshCall) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return originalFetch(input, init);
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
