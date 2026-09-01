import { redirect } from "next/navigation";
import { WalletContent } from "@/components/wallet/WalletContent";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await callApi({ method: "GET", path: "/wallet/transactions", token: getAccessToken() });
  const initialBalance =
    !("error" in result) && result.status === 200 ? (result.json as { balance: number }).balance : 0;

  return <WalletContent user={user} initialBalance={initialBalance} />;
}
