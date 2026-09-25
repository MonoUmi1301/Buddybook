import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getCurrentUser } from "@/lib/api/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/");

  return (
    <div className="min-h-screen bg-white">
      <Navbar user={user} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="mb-5 text-h2 text-neutral-900">Admin</h1>
        {/* desktop-first: แถบเมนูแนวตั้งด้านซ้าย ต่ำกว่า lg ย้ายขึ้นไปเป็นแท็บแนวนอนเต็มความกว้าง */}
        <div className="flex gap-5 max-lg:flex-col">
          <AdminSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
    </div>
  );
}
