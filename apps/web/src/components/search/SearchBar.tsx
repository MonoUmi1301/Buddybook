"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** ช่องค้นหาแบบ pill พร้อมปุ่มล้าง/ค้นหา ดู wf_empty_states.png (หน้าค้นหา)
 *  คง field/tag_id/sort/legal_status เดิมไว้ตอนพิมพ์คำค้นใหม่ (ไม่งั้นสลับแท็บ SearchFilterTabs
 *  ไว้แล้วพิมพ์ค้นหาต่อจะรีเซ็ตกลับไป "ทั้งหมด" ทุกครั้ง) */
export function SearchBar({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    router.push(`/search${params.size > 0 ? `?${params.toString()}` : ""}`);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex items-center gap-2.5 rounded-pill border border-neutral-200 bg-neutral-50 py-1.5 pl-4 pr-1.5"
    >
      <Search className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden="true" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="text"
        placeholder="ค้นหานิยาย, นามปากกา, แท็ก..."
        className="flex-1 bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="ล้างคำค้นหา"
          className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <Button type="submit" variant="primary">
        ค้นหา
      </Button>
    </form>
  );
}
