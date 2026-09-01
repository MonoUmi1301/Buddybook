import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, PawPrint } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SearchResultCard, type SearchNovelItem } from "@/components/search/SearchResultCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { callApi } from "@/lib/api/proxy";
import { getCurrentUser } from "@/lib/api/session";
import { getPenName } from "@/lib/displayName";

interface PublicProfile {
  user_id: string;
  username: string;
  pen_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  novel_count: number;
  novels: SearchNovelItem[];
}

export default async function ProfilePage({ params }: { params: { userId: string } }) {
  const [user, result] = await Promise.all([
    getCurrentUser(),
    callApi({ method: "GET", path: `/users/${params.userId}` }),
  ]);

  if ("error" in result || result.status === 404) notFound();
  if (result.status !== 200) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Navbar user={user} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            เชื่อมต่อ API Gateway ไม่ได้ตอนนี้ — ตรวจสอบว่า apps/api (Express) กำลังรันอยู่หรือไม่
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const profile = result.json as PublicProfile;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5 border-b border-neutral-200 pb-6">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-brand-tan/15">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.username} fill sizes="80px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <PawPrint className="h-9 w-9 -rotate-12 text-brand-tan-dark" fill="currentColor" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-h3 text-neutral-900">{getPenName(profile)}</h1>
            {profile.pen_name && <p className="truncate text-xs text-neutral-400">@{profile.username}</p>}
            {profile.bio && <p className="mt-1 text-sm text-neutral-600">{profile.bio}</p>}
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500">
              <CalendarDays className="h-3.5 w-3.5" />
              เข้าร่วมเมื่อ {new Date(profile.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "long" })}
            </p>
          </div>
        </div>

        <h2 className="mb-4 mt-8 text-h4 text-neutral-900">ผลงาน ({profile.novel_count})</h2>

        {profile.novels.length === 0 ? (
          <EmptyState title="ยังไม่มีผลงานที่เผยแพร่" size="sm" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {profile.novels.map((novel) => (
              <SearchResultCard key={novel.novel_id} novel={novel} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
