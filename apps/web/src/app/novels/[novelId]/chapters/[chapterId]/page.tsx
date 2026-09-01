import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AgeGateInterstitial } from "@/components/novel-detail/AgeGateInterstitial";
import { CommentSection, type CommentNode } from "@/components/novel-detail/CommentSection";
import { ReaderContent } from "@/components/reader/ReaderContent";
import { BackButton } from "@/components/ui/BackButton";
import { callApi, type ApiResult } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import { getPenName } from "@/lib/displayName";

function isAgeGateError(result: ApiResult): boolean {
  if ("error" in result) return false;
  return (
    result.status === 403 &&
    (result.json as { details?: { code?: string } } | null)?.details?.code === "AGE_VERIFICATION_REQUIRED"
  );
}

interface NovelSummary {
  novel_id: string;
  title: string;
  author: { username: string; pen_name: string | null };
}

interface ChapterDetail {
  chapter_id: string;
  novel_id: string;
  chapter_number: number;
  title: string;
  content: string | null;
  status: "draft" | "published";
  word_count: number;
}

interface ChapterListItem {
  chapter_id: string;
  chapter_number: number;
  title: string;
  status: "draft" | "published";
}

// หน้าอ่านตอนนิยาย — ต่อกับ GET /chapters/:id + /chapters/:id/comments จริง ดู wf_novel_detail.png (ตอนที่ 1/2)
export default async function ChapterReaderPage({
  params,
}: {
  params: { novelId: string; chapterId: string };
}) {
  const token = getAccessToken();
  const [novelResult, chapterResult, chaptersResult, commentsResult, user] = await Promise.all([
    callApi({ method: "GET", path: `/novels/${params.novelId}`, token }),
    callApi({ method: "GET", path: `/chapters/${params.chapterId}`, token }),
    callApi({ method: "GET", path: `/novels/${params.novelId}/chapters`, token }),
    callApi({ method: "GET", path: `/chapters/${params.chapterId}/comments` }),
    getCurrentUser(),
  ]);

  if (isAgeGateError(novelResult) || isAgeGateError(chapterResult)) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Navbar user={user} />
        <main className="flex-1">
          <AgeGateInterstitial />
        </main>
        <Footer />
      </div>
    );
  }

  if ("error" in novelResult || novelResult.status !== 200) notFound();
  if ("error" in chapterResult || chapterResult.status !== 200) notFound();

  const novel = novelResult.json as NovelSummary;
  const chapter = chapterResult.json as ChapterDetail;
  if (chapter.novel_id !== params.novelId) notFound();

  const chapters: ChapterListItem[] =
    !("error" in chaptersResult) && chaptersResult.status === 200
      ? (chaptersResult.json as { chapters: ChapterListItem[] }).chapters
          .filter((c) => c.status === "published")
          .sort((a, b) => a.chapter_number - b.chapter_number)
      : [];
  const currentIndex = chapters.findIndex((c) => c.chapter_id === chapter.chapter_id);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : undefined;
  const nextChapter = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : undefined;

  const comments: CommentNode[] =
    !("error" in commentsResult) && commentsResult.status === 200
      ? (commentsResult.json as { comments: CommentNode[] }).comments
      : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <BackButton variant="light" />
        </div>

        <ReaderContent
          novelId={novel.novel_id}
          novelTitle={novel.title}
          chapterNumber={chapter.chapter_number}
          chapterTitle={chapter.title}
          authorUsername={getPenName(novel.author)}
          content={chapter.content ?? ""}
          prevChapterId={prevChapter?.chapter_id}
          nextChapterId={nextChapter?.chapter_id}
        />

        <div className="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mt-8">
            <CommentSection chapterId={chapter.chapter_id} comments={comments} isLoggedIn={Boolean(user)} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
