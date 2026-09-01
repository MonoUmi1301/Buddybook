import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import type { SessionUser } from "@/lib/api/session";

interface InfoPageProps {
  title: string;
  user: SessionUser | null;
  children: React.ReactNode;
}

/** เทมเพลตกลางสำหรับหน้าเนื้อหาสถิต (about/guide/contact/terms/privacy) — กันไม่ให้ลิงก์ใน
 *  Footer เป็น href="#" ที่กดแล้วไม่ไปไหน อย่างน้อยก็มีหน้าจริงให้กดเข้าไปดูได้เสมอ */
export function InfoPage({ title, user, children }: InfoPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-h2 text-neutral-900">{title}</h1>
        <div className="space-y-4 text-sm leading-relaxed text-neutral-700">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
