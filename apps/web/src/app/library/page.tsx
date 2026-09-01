import { redirect } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LibraryNovelCard, type LibraryItem } from "@/components/library/LibraryNovelCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";

// หน้าชั้นหนังสือของผู้อ่าน — ต่อกับ GET /library จริงแล้ว
export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await callApi({ method: "GET", path: "/library", token: getAccessToken() });
  const items: LibraryItem[] =
    !("error" in result) && result.status === 200 ? (result.json as { library: LibraryItem[] }).library : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-h2 text-neutral-900">ชั้นหนังสือของฉัน</h1>

        {"error" in result && (
          <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            เชื่อมต่อ API Gateway ไม่ได้ตอนนี้ — ตรวจสอบว่า apps/api (Express) กำลังรันอยู่หรือไม่
          </p>
        )}

        {items.length === 0 ? (
          <EmptyState
            title="ยังไม่มีนิยายในชั้นหนังสือ"
            description={'ลองกด "เพิ่มเข้าชั้น" จากหน้ารายละเอียดนิยายดูสิ'}
            action={
              <Link
                href="/search"
                className="inline-flex h-9 items-center rounded-pill bg-primary-500 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-600"
              >
                ค้นหานิยาย
              </Link>
            }
          />
        ) : (
          <div className="flex flex-wrap gap-4">
            {items.map((item) => (
              <LibraryNovelCard key={item.library_id} item={item} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
