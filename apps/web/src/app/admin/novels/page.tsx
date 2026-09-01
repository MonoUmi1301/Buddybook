import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { NovelsList, type AdminPendingNovel } from "@/components/admin/NovelsList";

// GET /admin/novels/pending — ดู API_Endpoints.md ส่วนที่ 5
export default async function AdminNovelsPage() {
  const result = await callApi({ method: "GET", path: "/admin/novels/pending", token: getAccessToken() });
  const novels: AdminPendingNovel[] =
    !("error" in result) && result.status === 200
      ? (result.json as { novels: AdminPendingNovel[] }).novels
      : [];

  return <NovelsList initialNovels={novels} />;
}
