import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { TagsManager, type AdminTagRow } from "@/components/admin/TagsManager";

// GET /admin/tags — ดู API_Endpoints.md ส่วนที่ 5
export default async function AdminTagsPage() {
  const result = await callApi({ method: "GET", path: "/admin/tags", token: getAccessToken() });
  const tags: AdminTagRow[] =
    !("error" in result) && result.status === 200 ? (result.json as { tags: AdminTagRow[] }).tags : [];

  return <TagsManager initialTags={tags} />;
}
