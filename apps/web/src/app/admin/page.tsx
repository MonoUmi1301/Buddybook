import { BookOpen, FileText, ShieldAlert, Users } from "lucide-react";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";

interface AdminStats {
  total_users: number;
  total_novels: number;
  total_chapters: number;
  pending_review_count: number;
}

// GET /admin/reports/stats — ดู API_Endpoints.md ส่วนที่ 5
export default async function AdminDashboardPage() {
  const result = await callApi({ method: "GET", path: "/admin/reports/stats", token: getAccessToken() });
  const stats: AdminStats =
    !("error" in result) && result.status === 200
      ? (result.json as AdminStats)
      : { total_users: 0, total_novels: 0, total_chapters: 0, pending_review_count: 0 };

  const cards = [
    { label: "ผู้ใช้งานทั้งหมด", value: stats.total_users, icon: Users, color: "text-sky-500 bg-sky-50" },
    { label: "นิยายทั้งหมด", value: stats.total_novels, icon: BookOpen, color: "text-violet-500 bg-violet-50" },
    { label: "ตอนทั้งหมด", value: stats.total_chapters, icon: FileText, color: "text-emerald-500 bg-emerald-50" },
    {
      label: "รอตรวจสอบ",
      value: stats.pending_review_count,
      icon: ShieldAlert,
      color: "text-amber-500 bg-amber-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-card border border-neutral-200 p-5">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${c.color}`}>
            <c.icon className="h-5 w-5" />
          </span>
          <p className="mt-3 text-2xl font-bold text-neutral-900">{c.value.toLocaleString()}</p>
          <p className="text-sm text-neutral-500">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
