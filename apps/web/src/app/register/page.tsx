import { AuthForm } from "@/components/auth/AuthForm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api/session";

export default async function RegisterPage() {
  // ล็อกอินอยู่แล้วไม่ต้องเห็นฟอร์มอีก — เช็คกับ API จริง (ไม่ใช่แค่มี cookie) กัน token ค้างของบัญชีที่ถูกลบ
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <AuthForm mode="register" />
    </div>
  );
}
