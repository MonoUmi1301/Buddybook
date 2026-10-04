import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SupportCenter } from "@/components/support/SupportCenter";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import type { SupportTicketSummary } from "@/lib/support";

// gap 3.2 — ศูนย์ช่วยเหลือ / แจ้งปัญหา (Proposal 1.3: ระบบสนับสนุนผู้ใช้งาน/แจ้งปัญหา)
export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/support");

  const result = await callApi({ method: "GET", path: "/support/tickets", token: getAccessToken() });
  const tickets =
    !("error" in result) && result.status === 200 ? (result.json as { tickets: SupportTicketSummary[] }).tickets : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-h2 text-neutral-900">ศูนย์ช่วยเหลือ</h1>
        <p className="mb-6 mt-1 text-sm text-neutral-500">แจ้งปัญหาการใช้งาน การเงิน หรือเนื้อหา ทีมงานจะตอบกลับและแจ้งเตือนคุณทันที</p>
        <SupportCenter tickets={tickets} />
      </main>
      <Footer />
    </div>
  );
}
