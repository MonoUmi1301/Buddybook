import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Wand2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PublishVisibilityChoice } from "@/components/writer/PublishVisibilityChoice";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

interface NovelSummary {
  novel_id: string;
  title: string;
  visibility: "published" | "private" | "pending_review";
  author: { user_id: string };
}

// หลังสร้างนิยายเสร็จ (Phase C) — ให้เลือกว่าจะไปเขียนตอนแรกเลย หรือไปเครื่องมือช่วยแต่งนิยายก่อน
export default async function ChooseNextStepPage({ params }: { params: { novelId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const token = getAccessToken();
  const novelResult = await callApi({ method: "GET", path: `/novels/${params.novelId}`, token });
  if ("error" in novelResult || novelResult.status !== 200) notFound();
  const novel = novelResult.json as NovelSummary;
  if (novel.author.user_id !== user.user_id) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-h2 text-neutral-900">สร้าง &ldquo;{novel.title}&rdquo; สำเร็จแล้ว!</h1>
        <p className="mt-2 text-sm text-neutral-500">อยากเริ่มยังไงต่อดี?</p>

        <div className="mt-8 grid w-full gap-4 sm:grid-cols-2">
          <Link
            href={`/write/${novel.novel_id}/chapters/new`}
            className="flex flex-col items-center gap-3 rounded-card border-2 border-neutral-200 p-6 text-center transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            <BookOpen className="h-8 w-8 text-primary-500" />
            <span className="text-sm font-semibold text-neutral-900">ไปเขียนตอนแรก</span>
            <span className="text-xs text-neutral-500">เริ่มเขียนเนื้อหาตอนที่ 1 เลย</span>
          </Link>

          <Link
            href={`/write/${novel.novel_id}/plot`}
            className="flex flex-col items-center gap-3 rounded-card border-2 border-neutral-200 p-6 text-center transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            <Wand2 className="h-8 w-8 text-primary-500" />
            <span className="text-sm font-semibold text-neutral-900">ไปเครื่องมือช่วยแต่งนิยาย</span>
            <span className="text-xs text-neutral-500">วางโครงเรื่อง ตัวละคร ฉาก ก่อนเริ่มเขียน</span>
          </Link>
        </div>

        <PublishVisibilityChoice novelId={novel.novel_id} initialVisibility={novel.visibility} />

        <Link href={`/write/${novel.novel_id}`} className="mt-8 text-sm text-neutral-400 hover:text-neutral-600">
          ข้ามไปหน้าจัดการนิยาย
        </Link>
      </main>

      <Footer />
    </div>
  );
}
