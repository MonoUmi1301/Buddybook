import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { NovelManagementPanel, type ManagedNovel, type ManagedChapter } from "@/components/writer/NovelManagementPanel";
import type { NovelWizardTag } from "@/components/writer/CreateNovelForm";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

// หน้าจัดการนิยาย — จุดที่ขาดหายไปเดิม: กดเลือกนิยายที่มีอยู่แล้วจาก /write แทนที่จะโดดเข้า
// เครื่องมือ Plot ตรง ๆ ตอนนี้เจอหน้านี้ก่อน เห็นข้อมูลนิยาย + รายการตอนทุกสถานะ + ปุ่มลบ (Phase D)
export default async function NovelManagePage({ params }: { params: { novelId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const token = getAccessToken();
  const [novelResult, chaptersResult, tagsResult] = await Promise.all([
    callApi({ method: "GET", path: `/novels/${params.novelId}`, token }),
    callApi({ method: "GET", path: `/novels/${params.novelId}/chapters`, token }),
    callApi({ method: "GET", path: "/admin/tags" }),
  ]);

  if ("error" in novelResult || novelResult.status !== 200) notFound();
  const novel = novelResult.json as ManagedNovel;
  if (novel.author.user_id !== user.user_id) notFound();

  const chapters: ManagedChapter[] =
    !("error" in chaptersResult) && chaptersResult.status === 200
      ? ((chaptersResult.json as { chapters: ManagedChapter[] }).chapters ?? [])
      : [];

  const tags: NovelWizardTag[] =
    !("error" in tagsResult) && tagsResult.status === 200
      ? (tagsResult.json as { tags: NovelWizardTag[] }).tags
      : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <NovelManagementPanel novel={novel} chapters={chapters} tags={tags} />
      </main>

      <Footer />
    </div>
  );
}
