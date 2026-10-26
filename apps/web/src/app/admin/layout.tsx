import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getCurrentUser } from "@/lib/api/session";
import { getAdminStats } from "@/lib/adminStats";
import { getPenName } from "@/lib/displayName";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/");

  const stats = await getAdminStats();
  const badges = {
    "/admin/novels": stats.pending_appeal_count,
    "/admin/content-reports": stats.open_content_reports,
    "/admin/gift-reports": stats.open_gift_reports,
    "/admin/withdrawals": stats.pending_withdrawals,
    "/admin/support": stats.open_support_tickets,
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar user={user} />

      {/* แถบ "โหมดผู้ดูแลระบบ" — ให้รู้ชัดว่ากำลังอยู่หลังบ้าน ไม่ใช่หน้าเว็บปกติ */}
      {/* ใช้ neutral/bg-white — สว่างในโหมดปกติ และกลับเป็นสีมืดเองตามธีม (ดู globals.css) */}
      <div className="border-b border-neutral-200 bg-white text-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500 text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary-600 dark:text-primary-300">โหมดผู้ดูแลระบบ</p>
              <h1 className="text-xl font-bold sm:text-2xl">หลังบ้าน BuddyBook</h1>
              <p className="text-xs text-neutral-500">เข้าสู่ระบบในฐานะ {getPenName(user)}</p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-neutral-200 px-3 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> กลับไปหน้าเว็บ
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* desktop-first: แถบเมนูแนวตั้งด้านซ้าย ต่ำกว่า lg ย้ายขึ้นไปเป็นแท็บแนวนอนเต็มความกว้าง */}
        <div className="flex gap-5 max-lg:flex-col">
          <div className="shrink-0 max-lg:w-full lg:sticky lg:top-20 lg:self-start">
            <AdminSidebar badges={badges} />
          </div>
          <div className="min-w-0 flex-1">
            <AdminPageHeader />
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
