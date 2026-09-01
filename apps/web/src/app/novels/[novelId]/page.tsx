import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AgeGateInterstitial } from "@/components/novel-detail/AgeGateInterstitial";
import { NovelHero, type NovelDetailData } from "@/components/novel-detail/NovelHero";
import { ReviewCard, type Review } from "@/components/novel-detail/ReviewCard";
import { ReviewForm } from "@/components/novel-detail/ReviewForm";
import { CharacterIntro } from "@/components/novel-detail/CharacterIntro";
import { ContentWarningCard } from "@/components/novel-detail/ContentWarningCard";
import { ChapterListCard, type ChapterListItem } from "@/components/novel-detail/ChapterListCard";
import { NovelCommentsSection, type ChapterCommentGroup } from "@/components/novel-detail/NovelCommentsSection";
import type { CommentNode } from "@/components/novel-detail/CommentSection";
import { DonorList, type Donor } from "@/components/novel-detail/DonorList";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import { getPenName } from "@/lib/displayName";

const characterRoleLabel: Record<"protagonist" | "antagonist" | "supporting", string> = {
  protagonist: "พระเอก/นางเอก",
  antagonist: "ตัวร้าย",
  supporting: "ตัวประกอบ",
};

function isNovelDetail(json: unknown): json is NovelDetailData {
  return !!json && typeof json === "object" && "novel_id" in json && "author" in json;
}

interface ReviewApiItem {
  review_id: string;
  user: { user_id: string; username: string | null; avatar_url: string | null };
  is_anonymous: boolean;
  rating: number | null;
  comment_text: string | null;
  created_at: string;
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)));
}

// ต่อกับ GET /novels/:novel_id, /novels/:novel_id/reviews, /novels/:novel_id/chapters จริงทั้งหมด
export default async function NovelDetailPage({ params }: { params: { novelId: string } }) {
  const token = getAccessToken();
  const [result, user] = await Promise.all([
    callApi({ method: "GET", path: `/novels/${params.novelId}`, token }),
    getCurrentUser(),
  ]);

  // แยกให้ชัด: 404 จริง (ไม่มีนิยายนี้) ต้องขึ้นหน้า not-found ปกติ ส่วน network error/
  // 5xx อื่น ๆ (เช่น Prisma ต่อ DB ไม่ได้) ต้องขึ้นข้อความ error จริง ไม่ใช่บอกว่า "ไม่พบนิยาย"
  // ซึ่งจะเข้าใจผิดว่านิยายไม่มีอยู่ทั้งที่ backend แค่ล่ม
  if ("error" in result) {
    return (
      <div className="flex min-h-screen flex-col bg-neutral-50">
        <Navbar user={user} />
        <main className="mx-auto flex flex-1 max-w-5xl items-center justify-center px-4 py-16 text-center">
          <p className="text-sm text-red-500">
            เชื่อมต่อ API Gateway ไม่ได้ตอนนี้ — ตรวจสอบว่า apps/api (Express) กำลังรันอยู่หรือไม่
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (result.status === 404) {
    notFound();
  }

  if (result.status === 403 && (result.json as { details?: { code?: string } })?.details?.code === "AGE_VERIFICATION_REQUIRED") {
    return (
      <div className="flex min-h-screen flex-col bg-neutral-50">
        <Navbar user={user} />
        <main className="flex-1">
          <AgeGateInterstitial />
        </main>
        <Footer />
      </div>
    );
  }

  if (result.status >= 400 || !isNovelDetail(result.json)) {
    return (
      <div className="flex min-h-screen flex-col bg-neutral-50">
        <Navbar user={user} />
        <main className="mx-auto flex flex-1 max-w-5xl items-center justify-center px-4 py-16 text-center">
          <p className="text-sm text-red-500">
            เกิดข้อผิดพลาดขณะโหลดข้อมูลนิยาย (API Gateway ตอบกลับ status {result.status})
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const novel = result.json;

  const [reviewsResult, chaptersResult, libraryResult, donorsResult] = await Promise.all([
    // ต้องส่ง token ด้วย ไม่ใช่แค่ public fetch เฉย ๆ เพราะเจ้าของรีวิวที่เลือกไม่ระบุตัวตนไว้
    // ควรยังเห็นชื่อ/รูปจริงของตัวเองตอนดูรีวิวของตัวเองได้ (แค่คนอื่นเห็นเป็น "ผู้อ่านนิรนาม")
    callApi({ method: "GET", path: `/novels/${novel.novel_id}/reviews`, token }),
    callApi({ method: "GET", path: `/novels/${novel.novel_id}/chapters`, token }),
    user ? callApi({ method: "GET", path: "/library", token }) : Promise.resolve(null),
    callApi({ method: "GET", path: `/novels/${novel.novel_id}/donations` }),
  ]);

  const donors: Donor[] =
    !("error" in donorsResult) && donorsResult.status === 200
      ? (donorsResult.json as { donors: Donor[] }).donors
      : [];

  const reviews: Review[] =
    !("error" in reviewsResult) && reviewsResult.status === 200
      ? (reviewsResult.json as { reviews: ReviewApiItem[] }).reviews.map((r) => ({
          id: r.review_id,
          // backend ส่ง username เป็น null มาแล้วถ้าต้องปิดบัง (คนอื่นดูรีวิว anonymous ของคนอื่น) —
          // ถ้าไม่ null (ไม่ anonymous หรือเป็นรีวิว anonymous ของ viewer เอง) ให้แสดงชื่อจริงตามนั้น
          username: r.user.username ?? "ผู้อ่านนิรนาม",
          avatarUrl: r.user.avatar_url ?? undefined,
          rating: r.rating ?? 0,
          comment: r.comment_text ?? "",
          daysAgo: daysAgo(r.created_at),
        }))
      : [];

  const chapters: ChapterListItem[] =
    !("error" in chaptersResult) && chaptersResult.status === 200
      ? (chaptersResult.json as { chapters: ChapterListItem[] }).chapters
      : [];
  const publishedChapters = chapters
    .filter((c) => c.status === "published")
    .sort((a, b) => a.chapter_number - b.chapter_number);
  const firstChapter = publishedChapters[0];

  const chapterCommentsResults = await Promise.all(
    publishedChapters.map((c) => callApi({ method: "GET", path: `/chapters/${c.chapter_id}/comments` }))
  );
  const commentGroups: ChapterCommentGroup[] = publishedChapters.map((c, i) => {
    const r = chapterCommentsResults[i];
    const comments: CommentNode[] =
      !("error" in r) && r.status === 200 ? (r.json as { comments: CommentNode[] }).comments : [];
    return { chapterId: c.chapter_id, chapterNumber: c.chapter_number, chapterTitle: c.title, comments };
  });

  const inLibrary =
    libraryResult && !("error" in libraryResult) && libraryResult.status === 200
      ? (libraryResult.json as { library: { novel: { novel_id: string } }[] }).library.some(
          (item) => item.novel.novel_id === novel.novel_id
        )
      : false;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <Navbar user={user} />

      <main className="flex-1">
        <NovelHero
          novel={novel}
          initialInLibrary={inLibrary}
          isLoggedIn={Boolean(user)}
          firstChapterId={firstChapter?.chapter_id}
        />

        <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
          <section>
            <h2 className="mb-3 text-h3 text-neutral-900">
              รีวิวจากนักอ่านท่านอื่น
              {reviews.length > 0 && <span className="ml-1 text-neutral-400">({reviews.length})</span>}
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-neutral-400">ยังไม่มีรีวิว เป็นคนแรกที่รีวิวนิยายเรื่องนี้สิ!</p>
            ) : (
              <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                {reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            )}
            {user && (
              <div className="mt-4">
                <ReviewForm novelId={novel.novel_id} />
              </div>
            )}
          </section>

          {novel.character_nodes.length > 0 && (
            <CharacterIntro
              characters={novel.character_nodes.map((c) => ({
                id: c.node_id,
                name: c.character_name,
                role: c.character_role ? characterRoleLabel[c.character_role] : c.character_name,
                avatarUrl: c.avatar_url ?? undefined,
              }))}
            />
          )}
          <ContentWarningCard synopsis={novel.synopsis ?? ""} />
          <ChapterListCard novelId={novel.novel_id} chapters={chapters} />
          <DonorList
            novelId={novel.novel_id}
            authorId={novel.author.user_id}
            authorUsername={getPenName(novel.author)}
            donors={donors}
            isLoggedIn={Boolean(user)}
          />
          <NovelCommentsSection novelId={novel.novel_id} groups={commentGroups} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
