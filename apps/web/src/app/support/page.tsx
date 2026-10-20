import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SupportCenter } from "@/components/support/SupportCenter";
import { FaqAccordion } from "@/components/ui/faq-chat-accordion";
import { FAQ_DATA } from "@/lib/faq";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import type { SupportTicketSummary } from "@/lib/support";

// gap 3.2 — ศูนย์ช่วยเหลือ / แจ้งปัญหา (Proposal 1.3: ระบบสนับสนุนผู้ใช้งาน/แจ้งปัญหา)
// เพิ่มภายหลัง — มีคำถามที่พบบ่อยแบบแชทด้านบน เปิดดูได้โดยไม่ต้องเข้าสู่ระบบ (เดิม redirect ไป login ทันที)
// ส่วนแจ้งปัญหา/ประวัติเรื่องยังต้องเข้าสู่ระบบเหมือนเดิม
export default async function SupportPage() {
  const user = await getCurrentUser();

  let tickets: SupportTicketSummary[] = [];
  if (user) {
    const result = await callApi({ method: "GET", path: "/support/tickets", token: getAccessToken() });
    tickets =
      !("error" in result) && result.status === 200 ? (result.json as { tickets: SupportTicketSummary[] }).tickets : [];
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-h2 text-neutral-900">ศูนย์ช่วยเหลือ</h1>
        <p className="mb-6 mt-1 text-sm text-neutral-500">
          ลองหาคำตอบจากคำถามที่พบบ่อยก่อน ถ้าไม่เจอ แจ้งทีมงานได้ด้านล่าง ทีมงานจะตอบกลับและแจ้งเตือนคุณทันที
        </p>

        <section id="faq" className="scroll-mt-24 rounded-3xl border border-primary-200 bg-primary-50/50 dark:bg-transparent">
          <div className="flex items-center gap-3 border-b border-primary-200 px-5 py-4">
            <Image src="/donate/mascot/mascot-bear.png" alt="" width={44} height={44} className="h-11 w-11 rounded-full bg-white" />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">คำถามที่พบบ่อย</h2>
              <p className="text-xs text-neutral-500">กดที่คำถาม น้องหมีจะตอบให้</p>
            </div>
          </div>
          <FaqAccordion data={FAQ_DATA} className="mx-auto max-w-3xl py-6" />
          <p className="border-t border-primary-200 px-5 py-3 text-center text-sm">
            <Link href="/faq" className="font-medium text-primary-600 hover:underline">
              ดูคำถามทั้งหมด
            </Link>
            {" · "}
            <Link href="/guide" className="font-medium text-primary-600 hover:underline">
              คู่มือการใช้งาน
            </Link>
          </p>
        </section>

        <section id="ticket" className="mt-10 scroll-mt-24">
          <h2 className="mb-4 text-h3 text-neutral-900">แจ้งปัญหาการใช้งาน</h2>
          {user ? (
            <SupportCenter tickets={tickets} />
          ) : (
            <div className="rounded-card border border-dashed border-neutral-300 px-6 py-10 text-center">
              <p className="text-sm text-neutral-600">เข้าสู่ระบบก่อนแจ้งปัญหา เพื่อให้ทีมงานตรวจสอบบัญชีของคุณได้</p>
              <Link
                href="/login?next=/support%23ticket"
                className="mt-4 inline-flex h-11 items-center rounded-pill bg-primary-500 px-6 text-sm font-semibold text-white hover:bg-primary-600"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
