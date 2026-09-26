import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BackButton } from "@/components/ui/BackButton";
import { Tabs } from "@/components/ui/Tabs";
import { AgeGateInterstitial } from "@/components/novel-detail/AgeGateInterstitial";
import { NovelHero, type NovelDetailData } from "@/components/novel-detail/NovelHero";
import { NovelOverview } from "@/components/novel-detail/NovelOverview";
import { ChapterListCard, type ChapterListItem } from "@/components/novel-detail/ChapterListCard";
import { ReviewsPanel } from "@/components/novel-detail/ReviewsPanel";
import type { Review } from "@/components/novel-detail/ReviewCard";
import {
  NovelCommentsSection,
  countComments,
  type ChapterCommentGroup,
} from "@/components/novel-detail/NovelCommentsSection";
import type { CommentNode } from "@/components/novel-detail/CommentSection";
import { AuthorCard } from "@/components/novel-detail/AuthorCard";
import { ReaderSupportCard } from "@/components/gifts/ReaderSupportCard";
import type { PublicGifts } from "@/lib/gifts";
import { SideNovelList, type SideNovelItem } from "@/components/novel-detail/SideNovelList";
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

interface AuthorProfileApi {
  bio: string | null;
  novel_count: number;
  novels: (SideNovelItem & { novel_id: string })[];
}

interface SearchApi {
  novels: (SideNovelItem & { author: { username: string; pen_name: string | null } })[];
}

function ErrorShell({ user, message }: { user: Awaited<ReturnType<typeof getCurrentUser>>; message: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <Navbar user={user} />
      <main className="mx-auto flex max-w-5xl flex-1 items-center justify-center px-4 py-16 text-center">
        <p className="text-sm text-red-500">{message}</p>
      </main>
      <Footer />
    </div>
  );
}

// ต่อกับ GET /novels/:id, /reviews, /chapters, /donations, /users/:authorId และ /novels/search จริงทั้งหมด
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
      <ErrorShell
        user={user}
        message="เชื่อมต่อ API Gateway ไม่ได้ตอนนี้ — ตรวจสอบว่า apps/api (Express) กำลังรันอยู่หรือไม่"
      />
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
      <ErrorShell user={user} message={`เกิดข้อผิดพลาดขณะโหลดข้อมูลนิยาย (API Gateway ตอบกลับ status ${result.status})`} />
    );
  }

  const novel = result.json;
  const viewer = user ? { user_id: user.user_id, name: getPenName(user) } : null;

  const [reviewsResult, chaptersResult, libraryResult, supportResult, authorResult, similarResult, commentsResult] = await Promise.all([
    // ต้องส่ง token ด้วย ไม่ใช่แค่ public fetch เฉย ๆ เพราะเจ้าของรีวิวที่เลือกไม่ระบุตัวตนไว้
    // ควรยังเห็นชื่อ/รูปจริงของตัวเองตอนดูรีวิวของตัวเองได้ (แค่คนอื่นเห็นเป็น "ผู้อ่านนิรนาม")
    callApi({ method: "GET", path: `/novels/${novel.novel_id}/reviews`, token }),
    callApi({ method: "GET", path: `/novels/${novel.novel_id}/chapters`, token }),
    user ? callApi({ method: "GET", path: "/library", token }) : Promise.resolve(null),
    // "กำลังใจจากนักอ่าน" เฉพาะของขวัญที่ส่งมาทางนิยายเรื่องนี้ (ส่ง token ให้เจ้าของดูได้แม้นิยายยังไม่เผยแพร่)
    callApi({
      method: "GET",
      path: `/authors/${novel.author.user_id}/gifts/public`,
      token,
      searchParams: new URLSearchParams({ novel_id: novel.novel_id }),
    }),
    callApi({ method: "GET", path: `/users/${novel.author.user_id}` }),
    // "นิยายที่คล้ายกัน" = หมวดหมู่หลักเดียวกัน เรียงตามยอดวิว (ส่ง token เพื่อให้ gate เรต 18+ ตรงกับ viewer)
    novel.primary_tag
      ? callApi({
          method: "GET",
          path: `/novels/search?genre_ids=${novel.primary_tag.tag_id}&sort=views&pageSize=6`,
          token,
        })
      : Promise.resolve(null),
    // เพิ่มภายหลัง (perf) — คอมเมนต์ทุกตอนในครั้งเดียว (เดิมยิง /chapters/:id/comments ทีละตอนหลังจากนี้ = N+1)
    callApi({ method: "GET", path: `/novels/${novel.novel_id}/comments`, token }),
  ]);

  const support: PublicGifts | null =
    !("error" in supportResult) && supportResult.status === 200 ? (supportResult.json as PublicGifts) : null;

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
          createdAt: r.created_at,
          isAnonymous: r.user.username === null,
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
  const totalCharacters = publishedChapters.reduce((sum, c) => sum + (c.word_count ?? 0), 0);
  const lastPublishedAt = publishedChapters
    .map((c) => c.published_at)
    .filter((d): d is string => !!d)
    .sort()
    .slice(-1)[0];

  const rated = reviews.filter((r) => r.rating > 0);
  const averageRating = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;

  const authorProfile =
    !("error" in authorResult) && authorResult.status === 200 ? (authorResult.json as AuthorProfileApi) : null;
  const moreByAuthor: SideNovelItem[] = (authorProfile?.novels ?? [])
    .filter((n) => n.novel_id !== novel.novel_id)
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 4);

  const similarNovels: SideNovelItem[] =
    similarResult && !("error" in similarResult) && similarResult.status === 200
      ? (similarResult.json as SearchApi).novels
          .filter((n) => n.novel_id !== novel.novel_id)
          .slice(0, 4)
          .map((n) => ({ ...n, authorName: getPenName(n.author) }))
      : [];

  const commentsByChapter = new Map(
    !("error" in commentsResult) && commentsResult.status === 200
      ? (commentsResult.json as { chapters: { chapter_id: string; comments: CommentNode[] }[] }).chapters.map((c) => [
          c.chapter_id,
          c.comments,
        ])
      : []
  );
  const commentGroups: ChapterCommentGroup[] = publishedChapters.map((c) => ({
    chapterId: c.chapter_id,
    chapterNumber: c.chapter_number,
    chapterTitle: c.title,
    comments: commentsByChapter.get(c.chapter_id) ?? [],
  }));
  const commentCount = commentGroups.reduce((sum, g) => sum + countComments(g.comments), 0);

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
        {/* แถบไล่สีอ่อนโทนแบรนด์ด้านบน — ให้หัวเรื่องไม่ลอยบนพื้นเรียบ ๆ */}
        <div className="bg-gradient-to-b from-primary-500/10 via-brand-tan/5 to-transparent">
          <div className="mx-auto max-w-7xl px-4 pb-2 pt-4 sm:px-6 lg:px-8">
            <BackButton />
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 pb-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
          <div className="min-w-0 space-y-8">
            <NovelHero
              novel={novel}
              stats={{
                averageRating,
                reviewCount: rated.length,
                chapterCount: publishedChapters.length,
                totalCharacters,
              }}
              initialInLibrary={inLibrary}
              isLoggedIn={Boolean(user)}
              viewer={viewer}
              firstChapterId={firstChapter?.chapter_id}
            />

            <Tabs
              tabs={[
                {
                  id: "synopsis",
                  label: "เรื่องย่อ",
                  content: (
                    <NovelOverview
                      novel={novel}
                      characters={novel.character_nodes.map((c) => ({
                        id: c.node_id,
                        name: c.character_name,
                        role: c.character_role ? characterRoleLabel[c.character_role] : "ตัวละคร",
                        avatarUrl: c.avatar_url ?? undefined,
                      }))}
                      lastPublishedAt={lastPublishedAt}
                      totalCharacters={totalCharacters}
                    />
                  ),
                },
                {
                  id: "chapters",
                  label: "สารบัญ",
                  count: publishedChapters.length,
                  content: <ChapterListCard novelId={novel.novel_id} chapters={chapters} />,
                },
                {
                  id: "reviews",
                  label: "รีวิว",
                  count: reviews.length,
                  content: <ReviewsPanel novelId={novel.novel_id} reviews={reviews} isLoggedIn={Boolean(user)} />,
                },
                {
                  id: "comments",
                  label: "คอมเมนต์",
                  count: commentCount,
                  content: <NovelCommentsSection novelId={novel.novel_id} groups={commentGroups} />,
                },
              ]}
            />
          </div>

          <aside className="space-y-5">
            <AuthorCard
              author={novel.author}
              bio={authorProfile?.bio}
              novelCount={authorProfile?.novel_count}
              totalViews={authorProfile?.novels.reduce((s, n) => s + n.view_count, 0)}
              viewerId={user?.user_id}
            />
            {novel.allow_donations && (
              <ReaderSupportCard
                data={support}
                viewer={viewer}
                target={{
                  authorId: novel.author.user_id,
                  authorName: getPenName(novel.author),
                  novelId: novel.novel_id,
                  novelTitle: novel.title,
                }}
              />
            )}
            <SideNovelList
              title={`ผลงานอื่นของ ${getPenName(novel.author)}`}
              novels={moreByAuthor}
              moreHref={authorProfile && authorProfile.novel_count > 5 ? `/profile/${novel.author.user_id}` : undefined}
            />
            <SideNovelList
              title="นิยายที่คล้ายกัน"
              novels={similarNovels}
              moreHref={novel.primary_tag ? `/search?genre_ids=${novel.primary_tag.tag_id}` : undefined}
            />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
