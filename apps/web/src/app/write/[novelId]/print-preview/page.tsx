import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/writer/PrintButton";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import { getPenName } from "@/lib/displayName";

interface PrintPreviewData {
  novel: { novel_id: string; title: string; synopsis: string | null; author: { username: string; pen_name: string | null } };
  chapters: { chapter_number: number; title: string; content: string | null }[];
}

// พรีวิวก่อนพิมพ์ — เจ้าของนิยายเท่านั้น (ตรวจสิทธิ์ที่ backend, ดู novels.service.ts getPrintPreview)
export default async function PrintPreviewPage({ params }: { params: { novelId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await callApi({
    method: "GET",
    path: `/novels/${params.novelId}/print-preview`,
    token: getAccessToken(),
  });
  if ("error" in result || result.status === 404 || result.status === 403) notFound();
  if (result.status !== 200) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          เชื่อมต่อ API Gateway ไม่ได้ตอนนี้ — ตรวจสอบว่า apps/api (Express) กำลังรันอยู่หรือไม่
        </p>
      </div>
    );
  }

  const data = result.json as PrintPreviewData;

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <Link
          href={`/write/${params.novelId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปแก้ไข
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-3xl bg-white px-6 py-10 shadow-sm print:shadow-none sm:px-10">
        <h1 className="text-h1 text-neutral-900">{data.novel.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">โดย {getPenName(data.novel.author)}</p>
        {data.novel.synopsis && <p className="mt-4 text-sm leading-relaxed text-neutral-700">{data.novel.synopsis}</p>}

        {data.chapters.length === 0 ? (
          <p className="mt-10 text-sm text-neutral-500">นิยายเรื่องนี้ยังไม่มีตอน</p>
        ) : (
          data.chapters.map((chapter) => (
            <article key={chapter.chapter_number} className="mt-10 break-before-page first:break-before-auto">
              <h2 className="border-b border-neutral-200 pb-3 text-h3 text-neutral-900">
                ตอนที่ {chapter.chapter_number}: {chapter.title}
              </h2>
              <div className="prose prose-neutral mt-4 max-w-none whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                {chapter.content || <span className="italic text-neutral-400">(ยังไม่มีเนื้อหา)</span>}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
