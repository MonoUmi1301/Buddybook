import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PublishVisibilityChoice } from "@/components/writer/PublishVisibilityChoice";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

interface NovelSummary {
  novel_id: string;
  title: string;
  visibility: "published" | "private" | "suspended";
  author: { user_id: string };
}

// หลังสร้างนิยายเสร็จ ขั้นที่ 1/2 — เลือกสถานะการเผยแพร่ แล้วค่อยไปขั้นที่ 2 (/choose) เลือกว่าจะเริ่มยังไง
// แยกออกจากหน้า /choose เดิมที่เคยรวมสองเรื่องไว้หน้าเดียว (ผู้ใช้ขอ)
export default async function PublishStepPage({ params }: { params: { novelId: string } }) {
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
        <p className="text-xs font-medium text-primary-500">ขั้นที่ 1 จาก 2</p>
        <h1 className="mt-2 text-h2 text-neutral-900">สร้าง &ldquo;{novel.title}&rdquo; สำเร็จแล้ว!</h1>
        <p className="mt-2 text-sm text-neutral-500">จะเผยแพร่ให้ผู้อ่านเห็นเลย หรือเก็บไว้เป็นส่วนตัวก่อน?</p>

        <PublishVisibilityChoice novelId={novel.novel_id} initialVisibility={novel.visibility} />

        <Link
          href={`/write/${novel.novel_id}/choose`}
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-pill bg-primary-500 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-600"
        >
          ถัดไป <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-xs text-neutral-400">เปลี่ยนสถานะได้ทุกเมื่อจากหน้าจัดการนิยาย</p>
      </main>

      <Footer />
    </div>
  );
}
