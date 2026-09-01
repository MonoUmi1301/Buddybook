import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { UsersTable, type AdminUserRow } from "@/components/admin/UsersTable";

// GET /admin/users?page= — ดู API_Endpoints.md ส่วนที่ 5
export default async function AdminUsersPage() {
  const result = await callApi({
    method: "GET",
    path: "/admin/users",
    token: getAccessToken(),
    searchParams: new URLSearchParams({ page: "1" }),
  });
  const users: AdminUserRow[] =
    !("error" in result) && result.status === 200
      ? (result.json as { users: AdminUserRow[] }).users
      : [];

  return <UsersTable initialUsers={users} />;
}
