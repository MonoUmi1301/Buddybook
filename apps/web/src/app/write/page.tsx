import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

interface MyNovel {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  status: "ongoing" | "completed" | "hiatus";
  visibility: "published" | "private" | "pending_review";
}

const statusLabel: Record<MyNovel["status"], string> = {
  ongoing: "กำลังเขียน",
  completed: "จบแล้ว",
  hiatus: "พักเขียน",
};

const visibilityLabel: Record<MyNovel["visibility"], string> = {
  published: "เผยแพร่แล้ว",
  private: "ส่วนตัว",
  pending_review: "รอตรวจสอบ",
};

// หน้ารวมผลงานของนักเขียน — จุดเริ่มต้นก่อนเข้าเครื่องมือ world-building/chapter editor
export default async function WriterDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await callApi({
    method: "GET",
    path: "/novels/search",
    token: getAccessToken(),
    searchParams: new URLSearchParams({ mine: "true", page: "1" }),
  });

  const myNovels: MyNovel[] =
    !("error" in result) && result.status === 200 && result.json && typeof result.json === "object"
      ? ((result.json as { novels: MyNovel[] }).novels ?? [])
      : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-h2 text-neutral-900">ผลงานของฉัน</h1>

        {"error" in result && (
          <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            เชื่อมต่อ API Gateway ไม่ได้ตอนนี้ — ตรวจสอบว่า apps/api (Express) กำลังรันอยู่หรือไม่
          </p>
        )}

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          <Link
            href="/write/new"
            className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-primary-400 hover:text-primary-500"
          >
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">สร้างนิยายใหม่</span>
          </Link>

          {myNovels.map((n) => (
            <div key={n.novel_id} className="group">
              <Link href={`/write/${n.novel_id}`} className="block">
                <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-neutral-100">
                  {n.cover_image_url ? (
                    <Image src={n.cover_image_url} alt={n.title} fill sizes="200px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-300">
                      ไม่มีปก
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-pill bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                    {statusLabel[n.status]}
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-neutral-900 group-hover:text-primary-600">
                  {n.title}
                </h3>
                <p className="text-xs text-neutral-500">{visibilityLabel[n.visibility]}</p>
              </Link>
              <Link
                href={`/write/${n.novel_id}/chapters/new`}
                className="mt-1 inline-block text-xs font-medium text-primary-500 hover:text-primary-600"
              >
                + เขียนตอนใหม่
              </Link>
              <Link
                href={`/write/${n.novel_id}/trash`}
                className="ml-3 mt-1 inline-block text-xs font-medium text-neutral-400 hover:text-neutral-600"
              >
                ถังขยะ
              </Link>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
