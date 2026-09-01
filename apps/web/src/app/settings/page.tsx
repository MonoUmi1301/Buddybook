import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";
import { TwoFactorSection } from "@/components/settings/TwoFactorSection";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";
import { getCurrentUser } from "@/lib/api/session";

// เพิ่มภายหลัง (audit fix) — หน้าตั้งค่าบัญชีส่วนตัว จุดแรกคือ "ลบบัญชี" (โซนอันตราย)
// ไม่ใช่หน้าโปรไฟล์สาธารณะ (/profile/[userId] เป็นคนละหน้า ดูได้จากคนอื่น)
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-h2 text-neutral-900">ตั้งค่าบัญชี</h1>
        <p className="mt-1 text-sm text-neutral-500">จัดการบัญชีผู้ใช้ {user.username}</p>

        <div className="mt-6">
          <AccountSettingsForm username={user.username} penName={user.pen_name} bio={user.bio} avatarUrl={user.avatar_url} />
        </div>

        <div className="mt-6">
          <TwoFactorSection enabled={user.totp_enabled} />
        </div>

        <div className="mt-6">
          <DeleteAccountSection hasPassword={user.has_password} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
