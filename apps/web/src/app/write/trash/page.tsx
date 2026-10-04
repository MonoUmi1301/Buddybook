import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { NovelTrashList, type TrashedNovel } from "@/components/writer/NovelTrashList";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

// gap 2.4 — หน้านิยายที่ถูกลบ (Userflow: หน้านิยายที่ถูกลบ → กู้คืน / ลบถาวร)
export default async function NovelTrashPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await callApi({ method: "GET", path: "/novels/trash", token: getAccessToken() });
  const data =
    !("error" in result) && result.status === 200
      ? (result.json as { novels: TrashedNovel[]; retention_days: number })
      : { novels: [], retention_days: 30 };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/write" className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-500">
          <ChevronLeft className="h-4 w-4" /> ผลงานของฉัน
        </Link>
        <h1 className="mb-2 text-h2 text-neutral-900">นิยายที่ถูกลบ</h1>
        {"error" in result && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ตอนนี้</p>
        )}
        <NovelTrashList novels={data.novels} retentionDays={data.retention_days} />
      </main>
      <Footer />
    </div>
  );
}
