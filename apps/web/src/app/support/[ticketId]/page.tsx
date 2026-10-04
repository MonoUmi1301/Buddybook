import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SupportThread } from "@/components/support/SupportThread";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import type { SupportTicketDetail } from "@/lib/support";

// gap 3.2 — บทสนทนาเรื่องแจ้งปัญหา (เจ้าของเรื่อง + ทีมงาน)
export default async function SupportTicketPage({ params }: { params: { ticketId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/support/${params.ticketId}`);

  const result = await callApi({ method: "GET", path: `/support/tickets/${params.ticketId}`, token: getAccessToken() });
  if ("error" in result || result.status !== 200) notFound();
  const ticket = result.json as SupportTicketDetail;
  const isStaff = user.role === "admin" && ticket.user.user_id !== user.user_id;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={isStaff ? "/admin/support" : "/support"}
          className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-500"
        >
          <ChevronLeft className="h-4 w-4" /> {isStaff ? "คิวแจ้งปัญหา" : "ศูนย์ช่วยเหลือ"}
        </Link>
        <SupportThread ticket={ticket} isStaff={isStaff} />
      </main>
      <Footer />
    </div>
  );
}
