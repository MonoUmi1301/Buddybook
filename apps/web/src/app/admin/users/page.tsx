import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { UsersTable, type AdminUserRow, type AccountFilter } from "@/components/admin/UsersTable";

const FILTERS: AccountFilter[] = ["all", "real", "demo"];

// GET /admin/users?page=&type=all|real|demo — ดู API_Endpoints.md ส่วนที่ 5
export default async function AdminUsersPage(props: { searchParams: Promise<{ type?: string }> }) {
  const searchParams = await props.searchParams;
  const type = FILTERS.includes(searchParams.type as AccountFilter) ? (searchParams.type as AccountFilter) : "all";
  const result = await callApi({
    method: "GET",
    path: "/admin/users",
    token: await getAccessToken(),
    searchParams: new URLSearchParams({ page: "1", type }),
  });
  const data =
    !("error" in result) && result.status === 200
      ? (result.json as { users: AdminUserRow[]; total: number })
      : { users: [], total: 0 };

  return <UsersTable key={type} initialUsers={data.users} total={data.total} filter={type} />;
}
