import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/lib/api/session";

export default async function RegisterPage() {
  // เหมือน /login — สมัครบัญชีใหม่ทับเซสชันเดิมโดยไม่รู้ตัวไม่ได้
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <AuthForm mode="register" />
    </div>
  );
}
