import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HomeContent } from "@/components/home/HomeContent";
import { getCurrentUser } from "@/lib/api/session";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { WORK_TYPE_COOKIE, resolveWorkType } from "@/lib/workType";
import type { NovelSummary } from "@/lib/types";
import { getPenName } from "@/lib/displayName";
import type { ImageAccordionItem } from "@/components/ui/image-accordion";
import type { TrendingSlide } from "@/components/home/TrendingCoverflow";
import { buildTrendingMeta } from "@/lib/novelMeta";
import type { ContinueReadingItem } from "@/lib/library";

interface ApiNovel {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  view_count: number;
  rating?: number;
  review_count?: number;
  like_count?: number;
  chapter_count?: number;
  author: { username: string; pen_name: string | null };
}

function toNovelSummary(n: ApiNovel): NovelSummary {
  return {
    id: n.novel_id,
    title: n.title,
    penName: getPenName(n.author),
    coverImageUrl: n.cover_image_url ?? `https://picsum.photos/seed/${n.novel_id}/400/600`,
    viewCount: n.view_count.toLocaleString(),
    likeCount: (n.like_count ?? 0).toLocaleString(),
    rating: n.rating,
    reviewCount: n.review_count,
    tags: [],
    href: `/novels/${n.novel_id}`,
  };
}

interface HomeTag {
  tag_id: number;
  name: string;
  category: "genre" | "mood" | "theme" | "pairing" | "fandom" | null;
  parent_tag_id?: number | null;
}

async function fetchRawNovels(searchParams: URLSearchParams): Promise<ApiNovel[]> {
  const result = await callApi({ method: "GET", path: "/novels/search", searchParams, token: getAccessToken() });
  if ("error" in result || result.status !== 200) return [];
  return (result.json as { novels: ApiNovel[] }).novels;
}

async function fetchNovels(searchParams: URLSearchParams): Promise<NovelSummary[]> {
  // เพิ่มภายหลัง (Phase H) — เดิมจุดนี้ไม่ส่ง token เหมือน search/page.tsx ก่อนแก้ ทำให้ผู้ใช้ที่
  // ยืนยันอายุ 18+ แล้วก็ยังไม่เห็นนิยาย mature ในหมวด "ติดท็อป"/"ใหม่มาแรง" ของหน้าแรก
  const result = await callApi({
    method: "GET",
    path: "/novels/search",
    searchParams,
    token: getAccessToken(),
  });
  if ("error" in result || result.status !== 200) return [];
  const data = result.json as { novels: ApiNovel[] };
  return data.novels.map(toNovelSummary);
}

export default async function HomePage() {
  const user = await getCurrentUser();
  // เพิ่มภายหลัง (Phase Q, MASTER BRIEF) — ตัด bb_onboarding_skipped cookie ออก ไม่มีทางข้ามแล้ว
  // middleware.ts เป็นตัวหลักที่บังคับ redirect จากทุกหน้าอยู่แล้ว (Phase R) แต่คงเช็คซ้ำไว้ที่นี่
  // เป็น defense-in-depth เผื่อ middleware cookie ยังไม่ sync (ดูเหตุผลใน middleware.ts)
  if (user && !user.has_interests) redirect("/onboarding");

  // เพิ่มภายหลัง (BRIEF: Navbar Global Mode) — Navbar.tsx เขียน cookie นี้ตอนกดสลับ นิยาย/แฟนฟิค
  // อ่านที่นี่เพื่อกรองเนื้อหาหน้าแรกทั้งหมดให้ตรงโหมด (ไม่งั้น "หน้าหลักต้องสลับ" จะไม่มีทางเกิดขึ้นจริง
  // เพราะหน้านี้เป็น Server Component render ครั้งเดียวตอน request ไม่มีทาง react ต่อ client state ได้)
  // ไม่มี cookie (ยังไม่เคยเลือก) = "นิยาย" ตรงกับแท็บที่ Navbar ไฮไลต์ไว้ (ดู DEFAULT_WORK_TYPE)
  const workType = resolveWorkType(cookies().get(WORK_TYPE_COOKIE)?.value);

  const legal: Record<string, string> = workType ? { legal_status: workType } : {};
  const token = getAccessToken();

  // เปลี่ยนภายหลัง (perf) — เดิมเป็น waterfall 5 ทอด (recommendations -> top/trending/tags -> genre ->
  // coverflow/continue-reading) ทั้งที่แทบทุกตัวไม่ได้รอกัน ตอนนี้ยิงพร้อมกันหมดหลังรู้ว่าเป็นใคร
  // มีแค่หมวดตามแท็กที่ต้องรอรายชื่อแท็กก่อน (เริ่มทันทีที่แท็กมา ไม่ต้องรอตัวอื่น)
  const tagsPromise = callApi({ method: "GET", path: "/admin/tags" });

  // หมวดหมู่ตามแท็กจริง (แทนหมวด Love novel/Boy love/... ที่เดิม hardcode ไว้ ไม่มีแท็กจริงรองรับ) —
  // แสดงเฉพาะแท็กที่มีนิยายจริงอย่างน้อย 1 เรื่อง กันหมวดว่างโล่ง ๆ
  // เพิ่มภายหลัง (Phase L) — genre ตอนนี้เป็นลำดับชั้น 2 ระดับ กรองเฉพาะหมวดหมู่หลัก (ไม่มี parent)
  // สำหรับหน้าแรก ไม่งั้นจะได้หมวดหมู่ย่อย 23 อันปนกับหมวดหลัก 7 อันมาสุ่มโชว์
  const genrePromise = tagsPromise.then(async (tagsResult) => {
    const allGenreTags: HomeTag[] =
      !("error" in tagsResult) && tagsResult.status === 200
        ? (tagsResult.json as { tags: HomeTag[] }).tags.filter((t) => t.category === "genre" && !t.parent_tag_id)
        : [];
    const sections = await Promise.all(
      allGenreTags.slice(0, 4).map(async (tag) => ({
        tagId: tag.tag_id,
        title: tag.name,
        novels: await fetchNovels(new URLSearchParams({ tag_ids: String(tag.tag_id), pageSize: "8", ...legal })),
      }))
    );
    return { allGenreTags, sections };
  });

  const [recommendationsResult, trendingRaw, trending, genres, continueResult] = await Promise.all([
    // ต่อกับ GET /recommendations จริง (Neo4j — content-based/collaborative/underrated) เฉพาะตอนล็อกอิน
    user ? callApi({ method: "GET", path: "/recommendations", token }) : Promise.resolve(null),
    // coverflow "มาแรงตอนนี้" ใช้ข้อมูลดิบ (rating/chapter_count) — "ติดท็อป" คือ 8 อันดับแรกของชุดเดียวกัน
    // (query เดียวกัน sort=views) จึงไม่ต้องยิง /novels/search ซ้ำอีกรอบ
    fetchRawNovels(new URLSearchParams({ sort: "views", pageSize: "12", ...legal })),
    fetchNovels(new URLSearchParams({ sort: "newest", pageSize: "6", ...legal })),
    genrePromise,
    user
      ? callApi({ method: "GET", path: "/library/continue-reading", searchParams: new URLSearchParams({ limit: "10" }), token })
      : Promise.resolve(null),
  ]);

  let recommended: NovelSummary[] | null = null;
  if (recommendationsResult && !("error" in recommendationsResult) && recommendationsResult.status === 200) {
    const data = recommendationsResult.json as { content_based: ApiNovel[]; collaborative: ApiNovel[]; underrated: ApiNovel[] };
    const seen = new Set<string>();
    recommended = [...data.content_based, ...data.collaborative, ...data.underrated]
      .filter((n) => (seen.has(n.novel_id) ? false : (seen.add(n.novel_id), true)))
      .slice(0, 6)
      .map(toNovelSummary);
  }

  // "ติดท็อป"/"ใหม่มาแรง" — ต่อกับ GET /novels/search จริง (sort=views/newest, ดู novels.service.ts)
  const top = trendingRaw.slice(0, 8).map(toNovelSummary);
  const { allGenreTags } = genres;
  const genreSections = genres.sections.filter((s) => s.novels.length > 0);

  // เพิ่มภายหลัง — hero "แนะนำประจำสัปดาห์" (ImageAccordion) แทน HeroCarousel เดิม: 5 เรื่องยอดวิวสูงสุด
  // (ระบบยังไม่มีแนวคิด "featured" ที่ทีมงานคัดเอง จึงใช้ยอดอ่านจริงแทน)
  const featured: ImageAccordionItem[] = top.slice(0, 5).map((n, i) => ({
    id: n.id,
    title: n.title,
    subtitle: n.penName,
    imageUrl: n.coverImageUrl,
    href: n.href,
    badge: i === 0 ? "#1 ยอดอ่าน" : undefined,
  }));

  const trendingSlides: TrendingSlide[] = trendingRaw.map((n, i) => ({
    src: n.cover_image_url ?? `https://picsum.photos/seed/${n.novel_id}/400/600`,
    alt: `ปก ${n.title}`,
    title: n.title,
    subtitle: getPenName(n.author),
    meta: buildTrendingMeta(n),
    href: `/novels/${n.novel_id}`,
    rank: i + 1,
  }));
  const continueReading: ContinueReadingItem[] =
    continueResult && !("error" in continueResult) && continueResult.status === 200
      ? (continueResult.json as { items: ContinueReadingItem[] }).items
      : [];

  return (
    <HomeContent
      user={user}
      recommended={recommended}
      top={top}
      trending={trending}
      genreSections={genreSections}
      featured={featured}
      trendingSlides={trendingSlides}
      continueReading={continueReading}
      categoryTags={allGenreTags.map((t) => ({ tag_id: t.tag_id, name: t.name }))}
      workType={workType}
    />
  );
}
