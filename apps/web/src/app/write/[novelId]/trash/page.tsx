import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TrashBinManager, type TrashItem } from "@/components/writer/TrashBinManager";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

interface NovelSummary {
  novel_id: string;
  title: string;
  author: { user_id: string };
}

// จัดการถังขยะของนิยาย — wireframe screen 21-22
export default async function NovelTrashPage({ params }: { params: { novelId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const token = getAccessToken();
  const [novelResult, trashResult] = await Promise.all([
    callApi({ method: "GET", path: `/novels/${params.novelId}`, token }),
    callApi({ method: "GET", path: `/novels/${params.novelId}/trash-bin`, token }),
  ]);

  if ("error" in novelResult || novelResult.status !== 200) notFound();
  const novel = novelResult.json as NovelSummary;
  if (novel.author.user_id !== user.user_id) notFound();

  const items: TrashItem[] =
    !("error" in trashResult) && trashResult.status === 200
      ? ((trashResult.json as { items: TrashItem[] }).items ?? [])
      : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-1 text-h2 text-neutral-900">ถังขยะของ {novel.title}</h1>
        <p className="mb-6 text-sm text-neutral-500">
          รายการที่ถูกลบจะถูกเก็บไว้ 30 วันก่อนลบถาวรอัตโนมัติ
        </p>

        {"error" in trashResult && (
          <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            เชื่อมต่อ API Gateway ไม่ได้ตอนนี้ — ตรวจสอบว่า apps/api (Express) กำลังรันอยู่หรือไม่
          </p>
        )}

        <TrashBinManager items={items} />
      </main>

      <Footer />
    </div>
  );
}
