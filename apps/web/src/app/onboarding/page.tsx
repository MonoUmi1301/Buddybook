import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Mascot } from "@/components/ui/Mascot";
import { Logo } from "@/components/ui/Logo";
import { getCurrentUser } from "@/lib/api/session";

/** ด่านแรกของ Onboarding (welcome) — wf_onboarding ตาม roadmap Phase 9
 *  gate: ไม่ล็อกอิน -> /login, เคยเลือกความสนใจแล้ว -> เข้าหน้าแรกได้เลย ไม่ต้องเจอซ้ำ
 *  เพิ่มภายหลัง (Phase Q, MASTER BRIEF) — ตัดปุ่ม "ข้ามขั้นตอนนี้" ออกทั้งหมด บังคับตอบเสมอ */
export default async function OnboardingWelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.has_interests) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo variant="light" className="text-h3" />
        </div>

        <div className="mb-6 flex justify-center">
          <Mascot />
        </div>

        <h1 className="text-h2 text-neutral-900">ยินดีต้อนรับ, {user.username}!</h1>
        <p className="mt-2 text-sm text-neutral-500">
          บอกให้เรารู้จักสิ่งที่คุณชอบอ่าน แล้วเราจะแนะนำนิยายที่ใช่สำหรับคุณโดยเฉพาะ
        </p>

        <Link
          href="/onboarding/interests"
          className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-brand-tan text-base font-medium text-white transition-colors hover:bg-brand-tan-dark"
        >
          เริ่มต้นเลือกความสนใจ
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
