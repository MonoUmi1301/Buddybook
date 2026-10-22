"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AdminBento, AdminBentoSkeleton, type AdminDashboardData } from "@/components/ui/admin-bento";

/** หน้าภาพรวมหลังบ้าน — ดึง GET /admin/dashboard ระหว่างโหลดแสดง skeleton รูปทรงเดียวกับ tile
 *  ถ้าเรียกไม่ได้ แสดงข้อมูลตัวอย่าง (DEMO) พร้อมบอกให้รู้ว่าไม่ใช่ตัวเลขจริง */
export function AdminDashboard({ adminName }: { adminName: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; data: AdminDashboardData } | { status: "error" }>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<AdminDashboardData>("/admin/dashboard")
      .then((res) => !cancelled && setState({ status: "ready", data: res.data }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);

  // เริ่ม resync (API ตอบ 202 ทันที) แล้วถามสถานะทุก 3 วินาทีจนเสร็จ — สูงสุด 10 นาที
  const resync = async () => {
    type Status = { running: boolean; error: string | null; updatedAt: string | null };
    let status = (await apiClient.post<Status>("/admin/recommendations/resync")).data;
    const deadline = Date.now() + 10 * 60 * 1000;
    while (status.running && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      status = (await apiClient.get<Status>("/admin/recommendations/resync")).data;
    }
    if (status.running) throw new Error("timeout");
    if (status.error) throw new Error(status.error);
    return status.updatedAt;
  };

  if (state.status === "loading") return <AdminBentoSkeleton />;

  return (
    <div className="space-y-3">
      {state.status === "error" && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Info className="h-3.5 w-3.5 shrink-0" />
          โหลดข้อมูลภาพรวมไม่สำเร็จ — กำลังแสดงข้อมูลตัวอย่าง
        </p>
      )}
      <AdminBento
        adminName={adminName}
        data={state.status === "ready" ? state.data : undefined}
        onResync={state.status === "ready" ? resync : undefined}
      />
    </div>
  );
}
