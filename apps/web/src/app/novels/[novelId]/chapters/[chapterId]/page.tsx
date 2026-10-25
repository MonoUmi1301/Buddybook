import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AgeGateInterstitial, parseAgeGate } from "@/components/novel-detail/AgeGateInterstitial";
import { CommentSection, type CommentNode } from "@/components/novel-detail/CommentSection";
import { ReaderContent } from "@/components/reader/ReaderContent";
import { ReaderPresence } from "@/components/reader/ReaderPresence";
import { ReportButton } from "@/components/social/ReportButton";
import { BackButton } from "@/components/ui/BackButton";
import { OwnerPreviewBar } from "@/components/novel-detail/OwnerPreviewBar";
import { callApi, type ApiResult } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import { getPenName } from "@/lib/displayName";

function ageGateOf(result: ApiResult) {
  if ("error" in result) return null;
  return parseAgeGate(result.status, result.json);
}

interface NovelSummary {
  novel_id: string;
  title: string;
  allow_donations: boolean;
  author: { user_id: string; username: string; pen_name: string | null };
}

interface ChapterDetail {
  chapter_id: string;
  novel_id: string;
  chapter_number: number;
  title: string;
  content: string | null;
  status: "draft" | "published" | "scheduled" | "hidden";
  word_count: number;
  /** เพิ่มภายหลัง (ตอนติดเหรียญ) */
  price_coins: number;
  locked: boolean;
  /** ตัวอย่างเนื้อหาแบบ plain text — มีเฉพาะตอนที่ locked */
  teaser: string | null;
}

interface ChapterListItem {
  chapter_id: string;
  chapter_number: number;
  title: string;
  status: "draft" | "published" | "scheduled" | "hidden";
}

const ownerChapterNotice: Record<Exclude<ChapterDetail["status"], "published">, string> = {
  draft: "ตอนนี้เป็นฉบับร่าง — ผู้อ่านยังไม่เห็น",
  scheduled: "ตอนนี้ตั้งเวลาเผยแพร่ไว้ — ผู้อ่านยังอ่านไม่ได้จนกว่าจะถึงเวลา",
  hidden: "ตอนนี้ถูกซ่อนอยู่ — ผู้อ่านมองไม่เห็น",
};

// หน้าอ่านตอนนิยาย — ต่อกับ GET /chapters/:id + /chapters/:id/comments จริง ดู wf_novel_detail.png (ตอนที่ 1/2)
export default async function ChapterReaderPage(
  props: {
    params: Promise<{ novelId: string; chapterId: string }>;
  }
) {
  const params = await props.params;
  const token = await getAccessToken();
  const [novelResult, chapterResult, chaptersResult, commentsResult, user] = await Promise.all([
    callApi({ method: "GET", path: `/novels/${params.novelId}`, token }),
    callApi({ method: "GET", path: `/chapters/${params.chapterId}`, token }),
    callApi({ method: "GET", path: `/novels/${params.novelId}/chapters`, token }),
    callApi({ method: "GET", path: `/chapters/${params.chapterId}/comments`, token }),
    getCurrentUser(),
  ]);

  const ageGate = ageGateOf(novelResult) ?? ageGateOf(chapterResult);
  if (ageGate) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Navbar user={user} />
        <main className="flex-1">
          <AgeGateInterstitial
            gate={ageGate}
            loggedIn={Boolean(user)}
            returnTo={`/novels/${params.novelId}/chapters/${params.chapterId}`}
          />
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

  const isOwner = user?.user_id === novel.author.user_id;
  // เจ้าของ (โหมดทดลองอ่าน) กดตอนก่อนหน้า/ถัดไปผ่านตอนที่ยังไม่เผยแพร่ได้ด้วย
  const chapters: ChapterListItem[] =
    !("error" in chaptersResult) && chaptersResult.status === 200
      ? (chaptersResult.json as { chapters: ChapterListItem[] }).chapters
          .filter((c) => isOwner || c.status === "published")
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
      {/* ผู้อ่านออนไลน์บนหน้าแอดมิน — นับเฉพาะผู้ที่ล็อกอิน ไม่นับเจ้าของที่ทดลองอ่าน */}
      {user && !isOwner && <ReaderPresence />}
      {isOwner && (
        <OwnerPreviewBar
          novelId={novel.novel_id}
          editChapterId={chapter.chapter_id}
          notice={chapter.status !== "published" ? ownerChapterNotice[chapter.status] : null}
        />
      )}

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <BackButton href={`/novels/${params.novelId}`} label="หน้านิยาย" useHistory />
        </div>

        <ReaderContent
          key={chapter.chapter_id}
          novelId={novel.novel_id}
          novelTitle={novel.title}
          chapterNumber={chapter.chapter_number}
          chapterTitle={chapter.title}
          authorUsername={getPenName(novel.author)}
          content={chapter.content ?? ""}
          prevChapterId={prevChapter?.chapter_id}
          nextChapterId={nextChapter?.chapter_id}
          paywall={
            chapter.locked
              ? {
                  chapterId: chapter.chapter_id,
                  priceCoins: chapter.price_coins,
                  teaser: chapter.teaser ?? "",
                  isLoggedIn: Boolean(user),
                }
              : undefined
          }
          gift={
            novel.allow_donations
              ? {
                  target: {
                    authorId: novel.author.user_id,
                    authorName: getPenName(novel.author),
                    novelId: novel.novel_id,
                    novelTitle: novel.title,
                    chapterId: chapter.chapter_id,
                  },
                  viewer: user ? { user_id: user.user_id, name: getPenName(user) } : null,
                }
              : undefined
          }
        />

        <div className="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
          {!isOwner && (
            <div className="mt-4 flex justify-end">
              <ReportButton targetType="chapter" targetId={chapter.chapter_id} isLoggedIn={Boolean(user)} />
            </div>
          )}
          <div className="mt-8">
            <CommentSection chapterId={chapter.chapter_id} comments={comments} isLoggedIn={Boolean(user)} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
