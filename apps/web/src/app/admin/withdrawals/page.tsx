import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { WithdrawalsManager, type AdminWithdrawalRow } from "@/components/admin/WithdrawalsManager";

// เพิ่มภายหลัง (ถอนรายได้นักเขียน) — GET /admin/withdrawals?status=pending
export default async function AdminWithdrawalsPage() {
  const result = await callApi({ method: "GET", path: "/admin/withdrawals", token: getAccessToken() });
  const withdrawals =
    !("error" in result) && result.status === 200
      ? (result.json as { withdrawals: AdminWithdrawalRow[] }).withdrawals
      : [];

  return <WithdrawalsManager initial={withdrawals} />;
}
