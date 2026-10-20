import { notFound, redirect } from "next/navigation";
import { BookPreview } from "@/components/writer/BookPreview";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import { getPenName } from "@/lib/displayName";

interface PrintPreviewData {
  novel: {
    novel_id: string;
    title: string;
    synopsis: string | null;
    cover_image_url?: string | null;
    author: { username: string; pen_name: string | null };
  };
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

  // พรีวิวแบบหนังสือพลิกหน้า เลือกขนาดกระดาษได้ (requirement ข้อ 8) — ดู components/writer/BookPreview.tsx
  return (
    <BookPreview
      backHref={`/write/${params.novelId}`}
      data={{
        novel: {
          novel_id: data.novel.novel_id,
          title: data.novel.title,
          synopsis: data.novel.synopsis,
          coverUrl: data.novel.cover_image_url ?? null,
          authorName: `โดย ${getPenName(data.novel.author)}`,
        },
        chapters: data.chapters,
      }}
    />
  );
}
