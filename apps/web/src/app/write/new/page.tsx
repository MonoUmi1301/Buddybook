import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CreateNovelForm, type NovelWizardTag } from "@/components/writer/CreateNovelForm";
import { callApi } from "@/lib/api/proxy";
import { getCurrentUser } from "@/lib/api/session";

// สร้างนิยายใหม่ — wizard 2 ขั้นตอน (Phase C) แทนฟอร์มแบนเดิม
export default async function CreateNovelPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tagsResult = await callApi({ method: "GET", path: "/admin/tags" });
  const tags: NovelWizardTag[] =
    !("error" in tagsResult) && tagsResult.status === 200
      ? (tagsResult.json as { tags: NovelWizardTag[] }).tags
      : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-h2 text-neutral-900">สร้างนิยายใหม่</h1>
        <CreateNovelForm tags={tags} />
      </main>

      <Footer />
    </div>
  );
}
