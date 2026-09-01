import { cookies } from "next/headers";
import { Navbar } from "@/components/layout/Navbar";
import { WORK_TYPE_COOKIE, asWorkType } from "@/lib/workType";
import { Footer } from "@/components/layout/Footer";
import { SearchBar } from "@/components/search/SearchBar";
import { AdvancedSearchPanel } from "@/components/search/AdvancedSearchPanel";
import { AuthorSearchInput } from "@/components/search/AuthorSearchInput";
import { TagMultiSelect } from "@/components/search/TagMultiSelect";
import { GenreFilterChips } from "@/components/search/GenreFilterChips";
import { PairingPresetButtons } from "@/components/search/PairingPresetButtons";
import { SearchSortSelect } from "@/components/search/SearchSortSelect";
import { SearchResultCard, type SearchNovelItem } from "@/components/search/SearchResultCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

interface AllTag {
  tag_id: number;
  name: string;
  category: "genre" | "mood" | "theme" | "pairing" | "fandom" | "freeform" | null;
  parent_tag_id?: number | null;
}

interface SearchResponse {
  novels: SearchNovelItem[];
  total: number;
  page: number;
}

function isSearchResponse(json: unknown): json is SearchResponse {
  return !!json && typeof json === "object" && Array.isArray((json as SearchResponse).novels);
}

interface SearchPageParams {
  q?: string;
  genre_ids?: string;
  sub_genre_ids?: string;
  pairing_ids?: string;
  fandom_ids?: string;
  tag_ids?: string;
  author?: string;
  sort?: string;
  legal_status?: string;
}

// เพิ่มภายหลัง (Phase S, MASTER BRIEF) — หน้าค้นหาแบบ ReadAWrite: มุมมองเริ่มต้นเรียบง่าย (ช่อง
// ค้นหาหลัก + เรียงลำดับ) ตัวกรองละเอียดสไตล์ AO3 (นักเขียน/หมวดหมู่/ความสัมพันธ์/fandom/แท็กอื่นๆ)
// ซ่อนหลังปุ่ม "ค้นหาแบบละเอียด" ตัด SearchFilterTabs (ทั้งหมด/ชื่อเรื่อง/เรื่องย่อ/แท็ก) ออกทั้งหมด
// ตามที่ระบุ กัน query logic ชนกัน — ช่องค้นหาหลักค้นทุก field พร้อมกันเสมอ (field=all โดย default)
export default async function SearchPage({ searchParams }: { searchParams: SearchPageParams }) {
  // เพิ่มภายหลัง (BRIEF: Navbar Global Mode) — ถ้า URL ไม่ได้ระบุ legal_status มาตรง ๆ (เช่น เข้าหน้า
  // ค้นหาผ่านไอคอนแว่นขยายเฉย ๆ ไม่ผ่านลิงก์ที่มี query) ให้ดึงโหมดปัจจุบันจาก cookie ที่ Navbar
  // เขียนไว้มาใช้แทน — URL ที่ระบุ legal_status ตรง ๆ (เช่น bookmark/deep link) ยังชนะเสมอ
  const effectiveLegalStatus = searchParams.legal_status ?? asWorkType(cookies().get(WORK_TYPE_COOKIE)?.value);

  const params = new URLSearchParams();
  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.genre_ids) params.set("genre_ids", searchParams.genre_ids);
  if (searchParams.sub_genre_ids) params.set("sub_genre_ids", searchParams.sub_genre_ids);
  if (searchParams.pairing_ids) params.set("pairing_ids", searchParams.pairing_ids);
  if (searchParams.fandom_ids) params.set("fandom_ids", searchParams.fandom_ids);
  if (searchParams.tag_ids) params.set("tag_ids", searchParams.tag_ids);
  if (searchParams.author) params.set("author", searchParams.author);
  if (searchParams.sort) params.set("sort", searchParams.sort);
  if (effectiveLegalStatus) params.set("legal_status", effectiveLegalStatus);

  // เพิ่มภายหลัง (Phase H) — เดิมจุดนี้ไม่ส่ง token เลย ทำให้ผู้ใช้ที่ยืนยันอายุ 18+ แล้วก็ยังหา
  // นิยาย mature ผ่านค้นหาไม่เจอ (buildContentRatingGate ใน novels.service.ts เช็ค requester_id
  // ซึ่งมาจาก token เท่านั้น — เหมือน bug เดิมที่เจอกับ novels/[id] และ chapters/[id] proxy routes)
  const [result, user, tagsResult] = await Promise.all([
    callApi({ method: "GET", path: "/novels/search", searchParams: params, token: getAccessToken() }),
    getCurrentUser(),
    callApi({ method: "GET", path: "/admin/tags" }),
  ]);

  const allTags: AllTag[] =
    !("error" in tagsResult) && tagsResult.status === 200 ? (tagsResult.json as { tags: AllTag[] }).tags : [];
  const genreTags = allTags.filter((t) => t.category === "genre");
  const pairingTags = allTags.filter((t) => t.category === "pairing");
  const fandomTags = allTags.filter((t) => t.category === "fandom");
  const freeformTags = allTags.filter((t) => t.category === "freeform");
  const isFanficMode = effectiveLegalStatus === "fan-fiction";

  const hasAdvancedFilter = Boolean(
    searchParams.author ||
      searchParams.genre_ids ||
      searchParams.sub_genre_ids ||
      searchParams.pairing_ids ||
      searchParams.fandom_ids ||
      searchParams.tag_ids
  );

  // "error" in result = network/timeout ยิงไม่ถึง Express เลย; result.status >= 400 = Express
  // ตอบกลับมาจริงแต่เป็น error (เช่น Prisma ต่อ DB ไม่ได้) — ทั้งสองแบบต้องถือเป็น error เหมือนกัน
  // ไม่งั้นจะเข้าใจผิดว่า "ค้นหาไม่เจอ" ทั้งที่จริง ๆ backend ล่ม
  let upstreamError = true;
  let data: SearchResponse = { novels: [], total: 0, page: 1 };

  if (!("error" in result) && result.status < 400 && isSearchResponse(result.json)) {
    upstreamError = false;
    data = result.json;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <SearchBar initialQuery={searchParams.q ?? ""} />

        <div className="mt-3 flex items-center justify-between gap-3">
          <AdvancedSearchPanel defaultOpen={hasAdvancedFilter}>
            {/* เพิ่มภายหลัง (BRIEF: แก้ Layout) — ช่องนักเขียนไม่ได้ถูกจัดอยู่ในฝั่งไหนตาม brief
                (ฝั่ง 1 = ความสัมพันธ์/แท็ก/ด้อม, ฝั่ง 2 = หมวดหมู่) วางเป็นแถวเต็มความกว้างด้านบนแทน */}
            <div className="sm:col-span-2">
              <AuthorSearchInput initialAuthor={searchParams.author ?? ""} />
            </div>

            {/* ฝั่งที่ 1 — สายความสัมพันธ์ + แท็กอื่นๆ + ด้อม/Fandom (เฉพาะโหมดแฟนฟิก) */}
            <div className="flex flex-col gap-4">
              {pairingTags.length > 0 && <PairingPresetButtons tags={pairingTags} />}
              {freeformTags.length > 0 && (
                <TagMultiSelect label="แท็กอื่นๆ" allTags={freeformTags} paramName="tag_ids" />
              )}
              {isFanficMode && fandomTags.length > 0 && (
                <TagMultiSelect
                  label="ด้อม / Fandom"
                  allTags={fandomTags}
                  paramName="fandom_ids"
                  placeholder="เช่น Harry Potter, Jujutsu Kaisen..."
                />
              )}
            </div>

            {/* ฝั่งที่ 2 — หมวดหมู่หลัก + หมวดหมู่รอง (กล่อง scroll อยู่ใน GenreFilterChips เอง) */}
            <div>{genreTags.length > 0 && <GenreFilterChips genreTags={genreTags} />}</div>
          </AdvancedSearchPanel>
        </div>

        <div className="mt-4 flex justify-end">
          <SearchSortSelect />
        </div>

        {upstreamError && (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            เชื่อมต่อ API Gateway ไม่ได้ตอนนี้ — ตรวจสอบว่า apps/api (Express) กำลังรันอยู่หรือไม่
          </p>
        )}

        {!upstreamError && data.novels.length === 0 && (
          <EmptyState
            title="ไม่พบนิยายที่ตรงกับคำค้นหา"
            description="ลองค้นด้วยคำอื่น หรือเลือกหมวดหมู่ที่ต่างออกไป"
            className="mt-6"
          />
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.novels.map((novel) => (
            <SearchResultCard key={novel.novel_id} novel={novel} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
