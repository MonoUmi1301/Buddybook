"use client";

import { useState } from "react";
import { ShieldBan } from "lucide-react";
import { cn } from "@/lib/cn";

export interface AdminUserRow {
  user_id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  is_suspended: boolean;
  created_at: string;
}

interface UsersTableProps {
  initialUsers: AdminUserRow[];
}

// PATCH /admin/users/:user_id/role|suspend — ดู API_Endpoints.md ส่วนที่ 5
export function UsersTable({ initialUsers }: UsersTableProps) {
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

  async function toggleSuspend(id: string) {
    setPendingId(id);
    const res = await fetch(`/api/v1/admin/users/${id}/suspend`, { method: "PATCH" });
    if (res.ok) {
      setUsers((us) => us.map((u) => (u.user_id === id ? { ...u, is_suspended: !u.is_suspended } : u)));
    }
    setPendingId(null);
  }

  return (
    <div className="overflow-x-auto rounded-card border border-neutral-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">Username</th>
            <th className="px-4 py-3 font-medium">Email</th>
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
              <td className="px-4 py-3 text-neutral-500">
                {new Date(u.created_at).toLocaleDateString("th-TH")}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  disabled={pendingId === u.user_id}
                  onClick={() => toggleRole(u.user_id, u.role)}
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
                  onClick={() => toggleSuspend(u.user_id)}
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
    </div>
  );
}
