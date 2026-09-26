import { AuthForm } from "@/components/auth/AuthForm";

/** ข้อความของ ?error= ที่ OAuth callback (api/v1/auth/oauth/[provider]/callback) ส่งกลับมา */
const oauthErrorMessages: Record<string, string> = {
  oauth_missing_code: "เข้าสู่ระบบไม่สำเร็จ (ยกเลิกหรือไม่ได้รับอนุญาตจากผู้ให้บริการ) กรุณาลองใหม่",
  oauth_state: "เซสชันเข้าสู่ระบบหมดอายุหรือไม่ถูกต้อง กรุณากดเข้าสู่ระบบใหม่อีกครั้ง",
  oauth_failed: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  oauth_unavailable: "ยังไม่เปิดใช้การเข้าสู่ระบบด้วยช่องทางนี้",
  oauth_account_conflict: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบด้วยวิธีที่ใช้สมัครไว้",
  oauth_suspended: "บัญชีนี้ถูกระงับการใช้งาน",
};

export default function LoginPage({ searchParams }: { searchParams: { error?: string; two_factor?: string } }) {
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
