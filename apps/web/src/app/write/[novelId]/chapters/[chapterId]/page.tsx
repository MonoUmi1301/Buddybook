import { notFound, redirect } from "next/navigation";
import { ChapterEditorForm } from "@/components/writer/ChapterEditorForm";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

interface NovelSummary {
  novel_id: string;
  title: string;
  author: { user_id: string };
}

interface ChapterDetail {
  chapter_id: string;
  novel_id: string;
  chapter_number: number;
  title: string;
  content: string | null;
  status: "draft" | "published" | "scheduled" | "hidden";
}

export default async function ChapterEditorPage({
  params,
}: {
  params: { novelId: string; chapterId: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const token = getAccessToken();
  const [novelResult, chapterResult] = await Promise.all([
    callApi({ method: "GET", path: `/novels/${params.novelId}`, token }),
    callApi({ method: "GET", path: `/chapters/${params.chapterId}`, token }),
  ]);

  if ("error" in novelResult || novelResult.status !== 200) notFound();
  const novel = novelResult.json as NovelSummary;
  if (novel.author.user_id !== user.user_id) notFound();

  if ("error" in chapterResult || chapterResult.status !== 200) notFound();
  const chapter = chapterResult.json as ChapterDetail;
  if (chapter.novel_id !== params.novelId) notFound();

  return (
    <ChapterEditorForm
      novelId={params.novelId}
      novelTitle={novel.title}
      chapterNumber={chapter.chapter_number}
      chapterId={chapter.chapter_id}
      initialTitle={chapter.title}
      initialContent={chapter.content ?? ""}
      initialStatus={chapter.status}
    />
  );
}
