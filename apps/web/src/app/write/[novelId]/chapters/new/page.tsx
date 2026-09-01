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

interface ChapterListItem {
  chapter_number: number;
}

export default async function NewChapterPage({ params }: { params: { novelId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const token = getAccessToken();
  const [novelResult, chaptersResult] = await Promise.all([
    callApi({ method: "GET", path: `/novels/${params.novelId}`, token }),
    callApi({ method: "GET", path: `/novels/${params.novelId}/chapters`, token }),
  ]);

  if ("error" in novelResult || novelResult.status !== 200) notFound();
  const novel = novelResult.json as NovelSummary;
  if (novel.author.user_id !== user.user_id) notFound();

  const chapters =
    !("error" in chaptersResult) && chaptersResult.status === 200
      ? ((chaptersResult.json as { chapters: ChapterListItem[] }).chapters ?? [])
      : [];
  const nextChapterNumber = chapters.reduce((max, c) => Math.max(max, c.chapter_number), 0) + 1;

  return (
    <ChapterEditorForm novelId={params.novelId} novelTitle={novel.title} chapterNumber={nextChapterNumber} />
  );
}
