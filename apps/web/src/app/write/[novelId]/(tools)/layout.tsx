import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { WriterSidebar } from "@/components/writer/WriterSidebar";
import { WriterHeader } from "@/components/writer/WriterHeader";
import { getCurrentUser } from "@/lib/api/session";

export default async function WriterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { novelId: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-white">
      <Navbar user={user} />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <WriterHeader />
        <div className="flex flex-col gap-5 sm:flex-row">
          <WriterSidebar novelId={params.novelId} />
          <div className="min-w-0 flex-1 rounded-card border border-neutral-200 p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
