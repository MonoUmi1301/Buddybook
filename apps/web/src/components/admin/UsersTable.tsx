"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldBan } from "lucide-react";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { cn } from "@/lib/cn";
import { ScrollFade } from "@/components/ui/ScrollFade";
import { THAI_TIME_ZONE } from "@/lib/format";
import { handleAsync } from "@/lib/handleAsync";

export interface AdminUserRow {
  user_id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  account_type: "DEMO" | "REAL";
  is_suspended: boolean;
  created_at: string;
}

export type AccountFilter = "all" | "real" | "demo";

const FILTER_LABELS: Record<AccountFilter, string> = { all: "ทั้งหมด", real: "ผู้ใช้จริง", demo: "ตัวอย่าง" };

interface UsersTableProps {
  initialUsers: AdminUserRow[];
  total: number;
  filter: AccountFilter;
}

// PATCH /admin/users/:user_id/role|suspend|unsuspend — ดู API_Endpoints.md ส่วนที่ 5
export function UsersTable({ initialUsers, total, filter }: UsersTableProps) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggleRole(id: string, currentRole: "user" | "admin") {
    const nextRole = currentRole === "admin" ? "user" : "admin";
    setPendingId(id);
    const res = await fetch(`/api/v1/admin/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    if (res.ok) {
      setUsers((us) => us.map((u) => (u.user_id === id ? { ...u, role: nextRole } : u)));
    }
    setPendingId(null);
  }

  async function toggleSuspend(id: string, isSuspended: boolean) {
    setPendingId(id);
    const action = isSuspended ? "unsuspend" : "suspend";
    const res = await fetch(`/api/v1/admin/users/${id}/${action}`, { method: "PATCH" });
    if (res.ok) {
      const data = (await res.json()) as { suspended: boolean };
      setUsers((us) => us.map((u) => (u.user_id === id ? { ...u, is_suspended: data.suspended } : u)));
    }
    setPendingId(null);
  }

  return (
    <div className="space-y-3">
      {/* ตัวกรองบัญชี — REAL = ผู้ใช้จริง, DEMO = บัญชีจาก seed/ข้อมูลตัวอย่าง (ล็อกอินไม่ได้) */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FILTER_LABELS) as AccountFilter[]).map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/users" : `/admin/users?type=${f}`}
            className={cn(
              "rounded-pill px-3 py-1 text-xs font-medium transition-colors",
              f === filter ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {FILTER_LABELS[f]}
          </Link>
        ))}
        <span className="text-xs text-neutral-500">
          {total.toLocaleString("th-TH")} บัญชี{users.length < total ? ` (แสดง ${users.length} รายการล่าสุด)` : ""}
        </span>
      </div>
      {/* จอแคบตารางเลื่อนแนวนอนได้ — ScrollFade ใส่เงาจางที่ขอบให้รู้ว่ายังมีคอลัมน์ Role/สถานะอยู่ทางขวา */}
      <ScrollFade className="rounded-card border border-neutral-200">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">ประเภท</th>
              <th className="px-4 py-3 font-medium">สมัครเมื่อ</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map((u) => (
              <tr key={u.user_id} className={cn(u.is_suspended && "opacity-50")}>
                <td className="px-4 py-3 font-medium text-neutral-900">{u.username}</td>
                <td className="px-4 py-3 text-neutral-600">{u.email}</td>
                <td className="px-4 py-3">
                  {u.account_type === "DEMO" ? <DemoBadge /> : <span className="text-xs font-medium text-emerald-700">ผู้ใช้จริง</span>}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {new Date(u.created_at).toLocaleDateString("th-TH", { timeZone: THAI_TIME_ZONE })}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={pendingId === u.user_id}
                    onClick={handleAsync(() => toggleRole(u.user_id, u.role))}
                    className={cn(
                      "rounded-pill px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                      u.role === "admin"
                        ? "bg-neutral-900 text-white hover:bg-neutral-700"
                        : "border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                    )}
                  >
                    {u.role}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={pendingId === u.user_id}
                    onClick={handleAsync(() => toggleSuspend(u.user_id, u.is_suspended))}
                    className={cn(
                      "flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                      u.is_suspended
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "border border-neutral-300 text-neutral-500 hover:bg-neutral-50"
                    )}
                  >
                    <ShieldBan className="h-3.5 w-3.5" />
                    {u.is_suspended ? "ถูกระงับ" : "ระงับ"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollFade>
    </div>
  );
}
