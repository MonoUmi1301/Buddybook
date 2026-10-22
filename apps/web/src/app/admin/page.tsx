import Link from "next/link";
import {
  Banknote,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Coins,
  FileText,
  Flag,
  Headset,
  ScrollText,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { AdminHero } from "@/components/ui/admin-hero";
import { getAdminStats } from "@/lib/adminStats";
import { getCurrentUser } from "@/lib/api/session";
import { getPenName } from "@/lib/displayName";
import { cn } from "@/lib/cn";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

// GET /admin/reports/stats — ดู API_Endpoints.md ส่วนที่ 5 ; bento ด้านบนดึง GET /admin/dashboard ฝั่ง client
export default async function AdminDashboardPage() {
  // layout.tsx กันไว้แล้ว เช็กซ้ำที่หน้านี้ด้วยเผื่อ layout ถูกเปลี่ยน — ไม่ใช่แอดมินกลับหน้าแรก
  const [user, stats] = await Promise.all([getCurrentUser(), getAdminStats()]);
  if (!user || user.role !== "admin") redirect("/");

  const cards = [
    { label: "ผู้ใช้งานทั้งหมด", value: stats.total_users, icon: Users, color: "text-sky-500 bg-sky-50" },
    { label: "นิยายทั้งหมด", value: stats.total_novels, icon: BookOpen, color: "text-violet-500 bg-violet-50" },
    { label: "ตอนทั้งหมด", value: stats.total_chapters, icon: FileText, color: "text-emerald-500 bg-emerald-50" },
    { label: "สมาชิกใหม่ 7 วัน", value: stats.new_users_7d, icon: UserPlus, color: "text-primary-500 bg-primary-50" },
  ];

  // งานที่รอแอดมิน — เรียงตามความเร่งด่วน (เงิน/รายงาน ก่อน)
  const tasks = [
    { href: "/admin/withdrawals", label: "คำขอถอนเงินรอโอน", count: stats.pending_withdrawals, icon: Banknote },
    { href: "/admin/content-reports", label: "รายงานเนื้อหารอตรวจ", count: stats.open_content_reports, icon: ShieldAlert },
    { href: "/admin/novels?tab=appeals", label: "คำอุทธรณ์นิยายรอพิจารณา", count: stats.pending_appeal_count, icon: ScrollText },
    { href: "/admin/support", label: "เรื่องแจ้งปัญหาที่ยังเปิดอยู่", count: stats.open_support_tickets, icon: Headset },
    { href: "/admin/gift-reports", label: "การ์ดของขวัญถูกรายงาน", count: stats.open_gift_reports, icon: Flag },
  ];
  const totalPending = tasks.reduce((s, t) => s + t.count, 0);

  return (
    <div className="space-y-5">
      <AdminHero />

      {/* ---- ภาพรวม (bento) — GET /admin/dashboard ---- */}
      <AdminDashboard adminName={getPenName(user)} />

      {/* ---- งานที่รอคุณ ---- */}
      <section className="rounded-card border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">งานที่รอคุณ</h3>
            <p className="text-xs text-neutral-500">
              {totalPending > 0 ? `มีงานค้างทั้งหมด ${totalPending.toLocaleString()} รายการ` : "ไม่มีงานค้าง เยี่ยมมาก!"}
            </p>
          </div>
          {totalPending === 0 && <CheckCircle2 className="h-7 w-7 text-emerald-500" />}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {tasks.map((t) => {
            const pending = t.count > 0;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                    pending
                      ? "border-primary-200 bg-primary-50/60 hover:border-primary-400 dark:border-primary-500/40 dark:bg-primary-500/10"
                      : "border-neutral-200 hover:bg-neutral-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      pending ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-400"
                    )}
                  >
                    <t.icon className="h-4 w-4" />
                  </span>
                  <span className={cn("flex-1 text-sm", pending ? "font-medium text-neutral-900" : "text-neutral-500")}>
                    {t.label}
                  </span>
                  <span className={cn("text-lg font-bold", pending ? "text-primary-600" : "text-neutral-300")}>
                    {t.count.toLocaleString()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- ภาพรวมแพลตฟอร์ม ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-card border border-neutral-200 bg-white p-5">
            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-neutral-900">{c.value.toLocaleString()}</p>
            <p className="text-sm text-neutral-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* เพิ่มภายหลัง (Gift donations) — ค่าธรรมเนียมแพลตฟอร์มจากของขวัญ */}
      <div className="rounded-card border border-neutral-200 bg-white p-5">
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
