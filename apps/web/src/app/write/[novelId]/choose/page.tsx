import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Wand2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

interface NovelSummary {
  novel_id: string;
  title: string;
  visibility: "published" | "private" | "suspended";
  author: { user_id: string };
}

// หลังสร้างนิยายเสร็จ ขั้นที่ 2/2 — ให้เลือกว่าจะไปเขียนตอนแรกเลย หรือไปเครื่องมือช่วยแต่งนิยายก่อน
// (ขั้นที่ 1 เลือกสถานะการเผยแพร่ แยกไปอยู่ที่ /write/[novelId]/publish)
export default async function ChooseNextStepPage(props: { params: Promise<{ novelId: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const token = await getAccessToken();
  const novelResult = await callApi({ method: "GET", path: `/novels/${params.novelId}`, token });
  if ("error" in novelResult || novelResult.status !== 200) notFound();
  const novel = novelResult.json as NovelSummary;
  if (novel.author.user_id !== user.user_id) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-medium text-primary-500">ขั้นที่ 2 จาก 2</p>
        <h1 className="mt-2 text-h2 text-neutral-900">อยากเริ่ม &ldquo;{novel.title}&rdquo; ยังไงดี?</h1>
        <p className="mt-2 text-sm text-neutral-500">เลือกได้เลย กลับมาทำอีกอย่างทีหลังก็ได้</p>

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

        <div className="mt-8 flex items-center gap-6 text-sm">
          <Link href={`/write/${novel.novel_id}/publish`} className="inline-flex items-center gap-1 text-neutral-400 hover:text-neutral-600">
            <ArrowLeft className="h-3.5 w-3.5" /> ย้อนกลับ
          </Link>
          <Link href={`/write/${novel.novel_id}`} className="text-neutral-400 hover:text-neutral-600">
            ข้ามไปหน้าจัดการนิยาย
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
