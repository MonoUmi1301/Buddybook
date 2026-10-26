import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompleteProfileForm } from "@/components/auth/CompleteProfileForm";
import { getAccessToken } from "@/lib/api/auth";
import { decodeJwtPayload } from "@/lib/api/jwtPayload";

export const metadata: Metadata = { title: "เพิ่มอีเมล" };

/** บัญชีที่ยังไม่มีอีเมล (token มี email_required) — proxy.ts พามาที่นี่จากทุกหน้า
 *  ไม่ได้ล็อกอิน → /login, มีอีเมลแล้ว → หน้าแรก */
export default async function CompleteProfilePage() {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  if (!decodeJwtPayload(token)?.email_required) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <CompleteProfileForm />
    </div>
  );
}
