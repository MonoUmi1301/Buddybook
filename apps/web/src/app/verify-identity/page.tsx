import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { VerifyIdentityFlow, type KycStatus } from "@/components/kyc/VerifyIdentityFlow";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import { safeReturnPath } from "@/lib/api/oauth";

const DISABLED: KycStatus = {
  enabled: false,
  status: "none",
  reject_reason: null,
  retry_allowed: true,
  document_type: null,
  completed_at: null,
};

// e-KYC — ยืนยันอายุด้วยบัตรประชาชน/พาสปอร์ต + สแกนใบหน้า (ต้องล็อกอิน ผลผูกกับบัญชีนี้)
export default async function VerifyIdentityPage(props: { searchParams: Promise<{ return_to?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await callApi({ method: "GET", path: "/kyc/status", token: await getAccessToken() });
  const status = !("error" in result) && result.status === 200 ? (result.json as KycStatus) : DISABLED;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <Navbar user={user} />
      <main className="flex-1">
        <VerifyIdentityFlow initialStatus={status} returnTo={safeReturnPath(searchParams.return_to, "/settings")} />
      </main>
      <Footer />
    </div>
  );
}
