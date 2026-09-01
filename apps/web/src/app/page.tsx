import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HomeContent } from "@/components/home/HomeContent";
import { getCurrentUser } from "@/lib/api/session";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { WORK_TYPE_COOKIE, asWorkType } from "@/lib/workType";
import type { NovelSummary } from "@/lib/types";
import { getPenName } from "@/lib/displayName";

interface ApiNovel {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  view_count: number;
  rating?: number;
  review_count?: number;
  like_count?: number;
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
  const workType = asWorkType(cookies().get(WORK_TYPE_COOKIE)?.value);

  // ต่อกับ GET /recommendations จริง (Neo4j — content-based/collaborative/underrated)
  // เฉพาะตอนล็อกอิน ดู recommendations.service.ts ฝั่ง apps/api
  let recommended: NovelSummary[] | null = null;
  if (user) {
    const result = await callApi({ method: "GET", path: "/recommendations", token: getAccessToken() });
    if (!("error" in result) && result.status === 200) {
      const data = result.json as { content_based: ApiNovel[]; collaborative: ApiNovel[]; underrated: ApiNovel[] };
      const seen = new Set<string>();
      recommended = [...data.content_based, ...data.collaborative, ...data.underrated]
        .filter((n) => (seen.has(n.novel_id) ? false : (seen.add(n.novel_id), true)))
        .slice(0, 6)
        .map(toNovelSummary);
    }
  }

  // "ติดท็อป"/"ใหม่มาแรง" — ต่อกับ GET /novels/search จริง (sort=views/newest, ดู novels.service.ts)
  // แทนที่ mock-data.ts เดิม ซึ่งมี novel_id ปลอมที่ไม่มีจริงใน DB — กดเข้าไปแล้ว 404 ทุกครั้ง
  const [top, trending, tagsResult] = await Promise.all([
    fetchNovels(new URLSearchParams({ sort: "views", pageSize: "8", ...(workType ? { legal_status: workType } : {}) })),
    fetchNovels(new URLSearchParams({ sort: "newest", pageSize: "6", ...(workType ? { legal_status: workType } : {}) })),
    callApi({ method: "GET", path: "/admin/tags" }),
  ]);

  // หมวดหมู่ตามแท็กจริง (แทนหมวด Love novel/Boy love/... ที่เดิม hardcode ไว้ ไม่มีแท็กจริงรองรับ) —
  // แสดงเฉพาะแท็กที่มีนิยายจริงอย่างน้อย 1 เรื่อง กันหมวดว่างโล่ง ๆ
  // เพิ่มภายหลัง (Phase L) — genre ตอนนี้เป็นลำดับชั้น 2 ระดับ กรองเฉพาะหมวดหมู่หลัก (ไม่มี parent)
  // สำหรับหน้าแรก ไม่งั้นจะได้หมวดหมู่ย่อย 23 อันปนกับหมวดหลัก 7 อันมาสุ่มโชว์
  const allGenreTags: HomeTag[] =
    !("error" in tagsResult) && tagsResult.status === 200
      ? (tagsResult.json as { tags: HomeTag[] }).tags.filter((t) => t.category === "genre" && !t.parent_tag_id)
      : [];
  const tags = allGenreTags.slice(0, 4);

  const genreSectionsRaw = await Promise.all(
    tags.map(async (tag) => ({
      tagId: tag.tag_id,
      title: tag.name,
      novels: await fetchNovels(
        new URLSearchParams({
          tag_ids: String(tag.tag_id),
          pageSize: "8",
          ...(workType ? { legal_status: workType } : {}),
        })
      ),
    }))
  );
  const genreSections = genreSectionsRaw.filter((s) => s.novels.length > 0);

  // Hero carousel — ใช้นิยาย top-viewed จริงแทน mock heroSlides เดิม (ลิงก์ไป /novels/hero-1
  // ที่ไม่มีจริงใน DB มาก่อน กดแล้ว 404 ทุกครั้ง)
  const heroSlides = top.slice(0, 4).map((n) => ({
    id: n.id,
    title: n.title,
    coverImageUrl: n.coverImageUrl,
    href: n.href,
  }));

  return (
    <HomeContent
      user={user}
      recommended={recommended}
      top={top}
      trending={trending}
      genreSections={genreSections}
      heroSlides={heroSlides}
      categoryTags={allGenreTags.map((t) => ({ tag_id: t.tag_id, name: t.name }))}
      workType={workType}
    />
  );
}
