"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/** เพิ่มภายหลัง (Phase O) — ช่องค้นชื่อนักเขียนแยกอิสระจากช่องค้นคำทั่วไป (SearchBar) แบบ AO3
 *  ที่แยกช่อง Author ออกจากช่อง Search ชัดเจน ใช้ query param "author" ต่างหากจาก q/field เดิม
 *  (field=author ยังใช้งานได้ฝั่ง backend เพื่อ backward-compat แต่ UI ไม่เสนอ tab นั้นอีกต่อไป) */
export function AuthorSearchInput({ initialAuthor = "" }: { initialAuthor?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialAuthor);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("author", value.trim());
    else params.delete("author");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ค้นหาชื่อนักเขียน..."
        className="h-9 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none"
      />
    </form>
  );
}
