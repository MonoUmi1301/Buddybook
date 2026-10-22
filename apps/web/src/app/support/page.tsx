import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SupportCenter } from "@/components/support/SupportCenter";
import { Plus } from "lucide-react";
import { FAQ_DATA } from "@/lib/faq";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import type { SupportTicketSummary } from "@/lib/support";

// gap 3.2 — ศูนย์ช่วยเหลือ / แจ้งปัญหา (Proposal 1.3: ระบบสนับสนุนผู้ใช้งาน/แจ้งปัญหา)
// เพิ่มภายหลัง — มีคำถามที่พบบ่อยแบบแชทด้านบน เปิดดูได้โดยไม่ต้องเข้าสู่ระบบ (เดิม redirect ไป login ทันที)
// ส่วนแจ้งปัญหา/ประวัติเรื่องยังต้องเข้าสู่ระบบเหมือนเดิม
/** จำนวนคำถามที่โชว์ในหน้านี้ ที่เหลือดูที่ /faq */
const FAQ_PREVIEW = 6;

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

        {/* คำถามที่พบบ่อยแบบย่อ — กล่องเรียบ 2 คอลัมน์ ไม่แย่งความเด่นจากส่วนแจ้งปัญหา (ห้องแชทเต็มอยู่ที่ /faq และปุ่มแชทลอย) */}
        <section id="faq" className="scroll-mt-24">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-neutral-900">คำถามที่พบบ่อย</h2>
            <Link href="/faq" className="shrink-0 text-sm font-medium text-primary-600 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>
          <div className="grid items-start gap-2 md:grid-cols-2">
            {FAQ_DATA.slice(0, FAQ_PREVIEW).map((item) => (
              <details key={item.id} className="group rounded-xl border border-neutral-200 bg-white px-4 py-3 open:border-primary-200">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-neutral-800 [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <Plus className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-45" aria-hidden />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {item.answer}
                  {item.link && (
                    <>
                      {" "}
                      <Link href={item.link.href} className="font-medium text-primary-600 hover:underline">
                        {item.link.label}
                      </Link>
                    </>
                  )}
                </p>
              </details>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            ไม่เจอคำตอบ? ดู <Link href="/guide" className="text-primary-600 hover:underline">คู่มือการใช้งาน</Link> หรือแจ้งทีมงานด้านล่าง
          </p>
        </section>

        <section id="ticket" className="mt-8 scroll-mt-24">
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
