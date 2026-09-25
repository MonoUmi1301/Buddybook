import { BookOpen, Coins, FileText, ShieldAlert, Users } from "lucide-react";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";

interface AdminStats {
  total_users: number;
  total_novels: number;
  total_chapters: number;
  pending_review_count: number;
  /** เพิ่มภายหลัง (Gift donations) — SUM(donations.fee_amount) สะสม / เดือนนี้ (ปฏิทินไทย) */
  platform_fee_total: number;
  platform_fee_this_month: number;
  platform_fee_percent: number;
}

const emptyStats: AdminStats = {
  total_users: 0,
  total_novels: 0,
  total_chapters: 0,
  pending_review_count: 0,
  platform_fee_total: 0,
  platform_fee_this_month: 0,
  platform_fee_percent: 10,
};

// GET /admin/reports/stats — ดู API_Endpoints.md ส่วนที่ 5
export default async function AdminDashboardPage() {
  const result = await callApi({ method: "GET", path: "/admin/reports/stats", token: getAccessToken() });
  const stats: AdminStats =
    !("error" in result) && result.status === 200 ? { ...emptyStats, ...(result.json as Partial<AdminStats>) } : emptyStats;

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
    <div className="space-y-4">
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

      {/* เพิ่มภายหลัง (Gift donations) — ค่าธรรมเนียมแพลตฟอร์มจากของขวัญ */}
      <div className="rounded-card border border-neutral-200 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-orange-500">
            <Coins className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-neutral-500">ค่าธรรมเนียมแพลตฟอร์มสะสม</p>
            <p className="text-2xl font-bold text-neutral-900">{stats.platform_fee_total.toLocaleString("th-TH")} คอยน์</p>
            <p className="mt-1 text-xs text-neutral-500">
              หัก {stats.platform_fee_percent}% จากของขวัญแต่ละรายการ (ปัดเศษลง, Custom coins ไม่หัก) ยังไม่ได้โอนเข้าบัญชีใด บันทึกไว้ในรายการโดเนท
            </p>
          </div>
          <div className="text-right max-sm:w-full max-sm:text-left">
            <p className="text-sm text-neutral-500">เดือนนี้</p>
            <p className="text-lg font-semibold text-neutral-900">{stats.platform_fee_this_month.toLocaleString("th-TH")} คอยน์</p>
          </div>
        </div>
      </div>
    </div>
  );
}
