import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { ModerationQueue, type ModerationQueuePage, type ModerationTab } from "@/components/admin/ModerationQueue";

const TABS: ModerationTab[] = ["unreviewed", "reported", "appeals", "suspended"];

// GET /admin/novels/moderation — post-moderation: นิยายเผยแพร่ทันที แอดมินสุ่มตรวจ/ระงับ/พิจารณาอุทธรณ์ทีหลัง
export default async function AdminNovelsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = TABS.includes(searchParams.tab as ModerationTab) ? (searchParams.tab as ModerationTab) : "unreviewed";
  const result = await callApi({
    method: "GET",
    path: "/admin/novels/moderation",
    token: getAccessToken(),
    searchParams: new URLSearchParams({ tab }),
  });
  const initial: ModerationQueuePage =
    !("error" in result) && result.status === 200
      ? (result.json as ModerationQueuePage)
      : { tab, novels: [], total: 0, page: 1, pageSize: 20, counts: { unreviewed: 0, reported: 0, appeals: 0, suspended: 0 } };

  return <ModerationQueue key={tab} initial={initial} />;
}
