import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { OnboardingWizard, type OnboardingTag } from "@/components/onboarding/OnboardingWizard";
import { getCurrentUser } from "@/lib/api/session";
import { callApi } from "@/lib/api/proxy";

// เพิ่มภายหลัง (Phase Q, MASTER BRIEF) — เปลี่ยนจากฟอร์มเดียวเลือกแท็กทั้งหมดพร้อมกัน เป็น wizard
// บังคับตอบ 3 หน้า (pairing/genre/theme) ไม่มีทางข้าม — ดึง tag ทุก category มาให้ OnboardingWizard
// กรองเองเป็น 3 กลุ่ม (เดิมดึงเฉพาะ /admin/tags เหมือนกัน แค่ไม่ filter category ตั้งแต่ต้นทาง)
export default async function OnboardingInterestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.has_interests) redirect("/");

  const result = await callApi({ method: "GET", path: "/admin/tags" });
  const tags: OnboardingTag[] =
    !("error" in result) && result.status === 200 ? (result.json as { tags: OnboardingTag[] }).tags : [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo variant="light" className="text-h3" />
        </div>

        <OnboardingWizard tags={tags} />
      </div>
    </div>
  );
}
