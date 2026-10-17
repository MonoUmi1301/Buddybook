import { AuthForm } from "@/components/auth/AuthForm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api/session";

/** ข้อความของ ?error= ที่ OAuth callback (api/v1/auth/oauth/[provider]/callback) ส่งกลับมา */
const oauthErrorMessages: Record<string, string> = {
  oauth_missing_code: "เข้าสู่ระบบไม่สำเร็จ (ยกเลิกหรือไม่ได้รับอนุญาตจากผู้ให้บริการ) กรุณาลองใหม่",
  oauth_state: "เซสชันเข้าสู่ระบบหมดอายุหรือไม่ถูกต้อง กรุณากดเข้าสู่ระบบใหม่อีกครั้ง",
  oauth_failed: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  oauth_unavailable: "ยังไม่เปิดใช้การเข้าสู่ระบบด้วยช่องทางนี้",
  oauth_account_conflict: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบด้วยวิธีที่ใช้สมัครไว้",
  oauth_suspended: "บัญชีนี้ถูกระงับการใช้งาน",
};

export default async function LoginPage({ searchParams }: { searchParams: { error?: string; two_factor?: string } }) {
  // ล็อกอินอยู่แล้วไม่ต้องเห็นฟอร์มอีก — เช็คกับ API จริง (ไม่ใช่แค่มี cookie) กัน token ค้างของบัญชีที่ถูกลบ
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <AuthForm
        mode="login"
        oauthTwoFactor={searchParams.two_factor === "oauth"}
        initialError={searchParams.error ? oauthErrorMessages[searchParams.error] ?? oauthErrorMessages.oauth_failed : null}
      />
    </div>
  );
}
