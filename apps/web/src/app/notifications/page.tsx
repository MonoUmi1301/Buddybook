import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/session";
import type { NotificationItem, NotificationType } from "@/lib/notifications";

// gap 3.3 — หน้าแจ้งเตือน (Proposal 1.3: หน้าแจ้งเตือน)
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/notifications");

  const result = await callApi({
    method: "GET",
    path: "/notifications",
    token: getAccessToken(),
    searchParams: new URLSearchParams({ page: "1", pageSize: "20" }),
  });
  const initial =
    !("error" in result) && result.status === 200
      ? (result.json as {
          notifications: NotificationItem[];
          total: number;
          page: number;
          pageSize: number;
          unread_count: number;
          muted_types: NotificationType[];
        })
      : { notifications: [], total: 0, page: 1, pageSize: 20, unread_count: 0, muted_types: [] };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-5 text-h2 text-neutral-900">การแจ้งเตือน</h1>
        <NotificationCenter initial={initial} />
      </main>
      <Footer />
    </div>
  );
}
