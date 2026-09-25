import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LibraryView, type LibraryFilter, type LibraryViewMode } from "@/components/library/LibraryView";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import type { Collection, LibraryCounts, LibraryEntry } from "@/lib/library";

const FILTERS: LibraryFilter[] = ["all", "reading", "up_next", "completed"];

// หน้าชั้นหนังสือของผู้อ่าน — ดึงข้อมูลทั้งหมดฝั่ง server (GET /library + /collections) แล้วส่งให้ LibraryView
// กรอง/สลับมุมมองฝั่ง client (เก็บใน URL ?status= & ?view=) ไม่ต้องยิง API ใหม่ทุกครั้งที่กดตัวกรอง
export default async function LibraryPage({ searchParams }: { searchParams: { status?: string; view?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const token = getAccessToken();
  const [libraryResult, collectionsResult] = await Promise.all([
    callApi({ method: "GET", path: "/library", token }),
    callApi({ method: "GET", path: "/collections", token }),
  ]);

  const apiDown = "error" in libraryResult;
  const library =
    !("error" in libraryResult) && libraryResult.status === 200
      ? (libraryResult.json as { library: LibraryEntry[]; counts: LibraryCounts })
      : { library: [], counts: { all: 0, reading: 0, up_next: 0, completed: 0 } };
  const collections =
    !("error" in collectionsResult) && collectionsResult.status === 200
      ? (collectionsResult.json as { collections: Collection[] }).collections
      : [];

  const initialFilter = FILTERS.includes(searchParams.status as LibraryFilter) ? (searchParams.status as LibraryFilter) : "all";
  const initialView: LibraryViewMode = searchParams.view === "spines" ? "spines" : "shelves";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-16 max-lg:px-6 max-lg:py-12 max-md:px-4 max-md:py-8">
        {apiDown ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            เชื่อมต่อ API Gateway ไม่ได้ตอนนี้ — ตรวจสอบว่า apps/api (Express) กำลังรันอยู่หรือไม่
          </p>
        ) : (
          <LibraryView
            entries={library.library}
            counts={library.counts}
            collections={collections}
            initialFilter={initialFilter}
            initialView={initialView}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
